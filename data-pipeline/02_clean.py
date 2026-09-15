"""
02_clean.py — normalizza i CSV di raw/ in un'unica tabella tidy.

Legge solo le sorgenti dichiarate in config.SORGENTI (gli altri file scaricati
dallo stesso dataset CKAN sono elencati in config.IGNORATI con il motivo) e
produce:

    clean/osservazioni.csv   istat,comune,provincia,anno,tema,voce,valore

dove `tema` e "imprese" o "addetti" e `voce` e uno dei sette settori dell'app,
oppure `tema` e "natimortalita" e `voce` e registrate/attive/iscrizioni/
cessazioni.

Le anomalie dei file di origine, tutte verificate sul dato reale:

  - nel 2022 i dieci comuni della BAT compaiono due volte, una sotto la
    provincia storica (BARI, FOGGIA) e una sotto BARLETTA-ANDRIA-TRANI, con
    valori identici. Si deduplica su (istat, anno) e si avvisa se i due valori
    non coincidono, perche in quel caso la scelta non sarebbe innocua.
  - nel 2022 e nel 2024 i nomi dei comuni hanno uno spazio iniziale.
  - "CASTELLUCCIO" nel 2020-2021 e "CASTELLUCCIO VALMAGGIORE" dal 2022.
  - migliaia di celle contengono "-" e altre sono vuote: entrambe valgono zero.

Il join con il GeoJSON e per nome normalizzato, unica chiave disponibile nei
CSV; ogni comune non riconosciuto viene elencato a fine esecuzione invece di
essere scartato in silenzio.

Uso:
    python 02_clean.py
"""

from __future__ import annotations

import csv
import json
import re
import sys
import unicodedata
from collections import defaultdict
from pathlib import Path

from config import (
    ALIAS_COMUNE,
    CLEAN,
    NON_COMUNI,
    COLONNE_ATECO,
    COLONNE_NATIMORTALITA,
    GEOJSON,
    IGNORATI,
    RAW,
    SETTORI,
    SORGENTI,
)

ENCODING_TENTATIVI = ("utf-8-sig", "utf-8", "latin-1")


# --- normalizzazione ------------------------------------------------------

def senza_accenti(testo: str) -> str:
    nfkd = unicodedata.normalize("NFKD", testo or "")
    return "".join(c for c in nfkd if not unicodedata.combining(c))


def norm_nome(testo: str) -> str:
    """
    Nome comune confrontabile: minuscolo, senza accenti, spazi compattati.

    L'apostrofo finale viene rimosso: i file scrivono NARDO', PATU', SECLI' in
    maiuscolo, dove l'ISTAT scrive Nardo, Patu, Secli con l'accento. Nessun
    comune italiano ha un nome che finisce davvero per apostrofo, quindi la
    regola e sicura e copre i casi futuri senza allungare ALIAS_COMUNE.
    """
    s = senza_accenti(testo).lower().replace("’", "'").strip()
    s = re.sub(r"\s+", " ", s).rstrip("'")
    return ALIAS_COMUNE.get(s, s)


def norm_colonna(testo: str) -> str:
    """Nome colonna confrontabile: underscore e spazi diventano uno spazio."""
    s = senza_accenti(testo).lower().replace("_", " ").replace("’", "'")
    return re.sub(r"\s+", " ", s).strip()


def num(valore: object) -> int:
    """
    Converte una cella in intero. "-" e la stringa vuota valgono zero: nei file
    IPRES indicano "nessuna impresa", non "dato mancante". Tollera il punto come
    separatore delle migliaia e gli spazi di allineamento.
    """
    s = str(valore if valore is not None else "").strip()
    if s in ("", "-", "..", "n.d.", "nd"):
        return 0
    s = s.replace(".", "").replace(",", "").replace(" ", "").replace("\xa0", "")
    return int(s) if s.lstrip("-").isdigit() else 0


def leggi_csv(percorso: Path) -> list[dict[str, str]]:
    """Legge un CSV provando piu codifiche e deducendo il separatore."""
    for enc in ENCODING_TENTATIVI:
        try:
            testo = percorso.read_text(encoding=enc)
        except UnicodeDecodeError:
            continue
        righe = testo.splitlines()
        prima = righe[0] if righe else ""
        sep = max(",;\t|", key=prima.count)
        return list(csv.DictReader(righe, delimiter=sep))
    print(f"    ! nessuna codifica valida per {percorso.name}")
    return []


# --- riconciliazione con il GeoJSON ---------------------------------------

def indice_geojson() -> dict[str, tuple[str, str, str]]:
    """nome normalizzato -> (codice istat, nome ufficiale, sigla provincia)."""
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    indice: dict[str, tuple[str, str, str]] = {}
    for feature in geo["features"]:
        p = feature["properties"]
        indice[norm_nome(p["nome"])] = (p["istat"], p["nome"], p["prov"])
    return indice


# --- lettura delle sorgenti -----------------------------------------------

def sorgente_di(nome_file: str) -> tuple[str, str] | None:
    """(tema, layout) per un file di raw/, None se va ignorato."""
    for frammento in IGNORATI:
        if frammento in nome_file:
            return None
    for frammento, tema, layout in SORGENTI:
        if frammento in nome_file:
            return tema, layout
    return None


def anno_dal_nome(nome_file: str) -> int | None:
    """Per la nati-mortalita l'anno sta nel nome della risorsa (imprese-2023)."""
    trovato = re.search(r"imprese-(20\d{2})", nome_file)
    return int(trovato.group(1)) if trovato else None


Osservazione = tuple[str, str, str, int, str, str, int]


def da_matrice_ateco(
    righe: list[dict[str, str]], tema: str, geo: dict, ignoti: set[str]
) -> list[Osservazione]:
    """Province,Comuni,Anni + una colonna per sezione ATECO."""
    if not righe:
        return []

    # Mappa colonna del file -> settore dell'app, calcolata una volta sola.
    mappa: dict[str, str] = {}
    non_mappate: list[str] = []
    for colonna in righe[0]:
        chiave = norm_colonna(colonna)
        if chiave in ("province", "provincia", "comuni", "comune", "anni",
                      "anno", "totale"):
            continue
        settore = COLONNE_ATECO.get(chiave)
        if settore:
            mappa[colonna] = settore
        elif chiave:
            non_mappate.append(colonna)
    if non_mappate:
        print(f"    ! colonne non mappate: {', '.join(non_mappate)}")

    # (istat, anno) -> settore -> valore, cosi i duplicati si incontrano.
    accumulato: dict[tuple[str, int], dict[str, int]] = {}
    meta: dict[tuple[str, int], tuple[str, str]] = {}
    conflitti = 0
    duplicati = 0

    for riga in righe:
        nome = norm_nome(riga.get("Comuni") or riga.get("COMUNI") or "")
        if not nome or nome in NON_COMUNI:
            continue
        if nome not in geo:
            ignoti.add(nome)
            continue
        istat, ufficiale, provincia = geo[nome]
        anno = num(riga.get("Anni") or riga.get("Anno") or riga.get("ANNO"))
        if not anno:
            continue

        per_settore = {s: 0 for s in SETTORI}
        for colonna, settore in mappa.items():
            per_settore[settore] += num(riga.get(colonna))

        chiave = (istat, anno)
        if chiave in accumulato:
            duplicati += 1
            if accumulato[chiave] != per_settore:
                conflitti += 1
                print(f"    ! {ufficiale} {anno}: due righe con valori "
                      f"diversi, tengo la prima")
            continue
        accumulato[chiave] = per_settore
        meta[chiave] = (ufficiale, provincia)

    if duplicati:
        print(f"    = {duplicati} righe duplicate scartate "
              f"({conflitti} con valori discordanti)")

    fuori: list[Osservazione] = []
    for (istat, anno), per_settore in accumulato.items():
        ufficiale, provincia = meta[(istat, anno)]
        for settore in SETTORI:
            fuori.append(
                (istat, ufficiale, provincia, anno, tema, settore,
                 per_settore[settore])
            )
    return fuori


def da_natimortalita(
    righe: list[dict[str, str]], anno: int, geo: dict, ignoti: set[str]
) -> list[Osservazione]:
    """Province,Comuni + Registrate,Attive,Iscrizioni,Cessazioni."""
    mappa = {
        colonna: COLONNE_NATIMORTALITA[norm_colonna(colonna)]
        for colonna in (righe[0] if righe else {})
        if norm_colonna(colonna) in COLONNE_NATIMORTALITA
    }

    fuori: list[Osservazione] = []
    visti: set[str] = set()
    for riga in righe:
        nome = norm_nome(riga.get("Comuni") or "")
        if not nome or nome in NON_COMUNI:
            continue
        if nome not in geo:
            ignoti.add(nome)
            continue
        istat, ufficiale, provincia = geo[nome]
        if istat in visti:
            continue
        visti.add(istat)
        for colonna, voce in mappa.items():
            fuori.append(
                (istat, ufficiale, provincia, anno, "natimortalita", voce,
                 num(riga.get(colonna)))
            )
    return fuori


# --- programma ------------------------------------------------------------

def main() -> int:
    if not GEOJSON.exists():
        print(f"! manca {GEOJSON}")
        return 1
    if not RAW.exists() or not any(RAW.iterdir()):
        print(f"! {RAW} e vuota: esegui prima 01_download.py --solo-noti")
        return 1

    geo = indice_geojson()
    print(f"GeoJSON: {len(geo)} comuni\n")

    osservazioni: list[Osservazione] = []
    ignoti: set[str] = set()
    usati = 0

    for percorso in sorted(RAW.iterdir()):
        if not percorso.is_file() or percorso.suffix.lower() != ".csv":
            continue
        sorgente = sorgente_di(percorso.name)
        if sorgente is None:
            continue
        tema, layout = sorgente
        print(f"[{tema}] {percorso.name}")
        righe = leggi_csv(percorso)
        print(f"    {len(righe)} righe lette")

        if layout == "matrice_ateco":
            nuove = da_matrice_ateco(righe, tema, geo, ignoti)
        else:
            anno = anno_dal_nome(percorso.name)
            if anno is None:
                print("    ! anno non deducibile dal nome, salto")
                continue
            print(f"    anno {anno}")
            nuove = da_natimortalita(righe, anno, geo, ignoti)

        print(f"    -> {len(nuove)} osservazioni")
        osservazioni.extend(nuove)
        usati += 1

    if usati == 0:
        print("\n! nessuna sorgente riconosciuta in raw/. Controlla che i nomi "
              "dei file contengano le sottostringhe di config.SORGENTI.")
        return 1

    if ignoti:
        print(f"\n! {len(ignoti)} nomi comune non riconciliati col GeoJSON:")
        for nome in sorted(ignoti):
            print(f"    - {nome}")
        print("  aggiungili a config.ALIAS_COMUNE se sono varianti di nome.")

    CLEAN.mkdir(parents=True, exist_ok=True)
    destinazione = CLEAN / "osservazioni.csv"
    with destinazione.open("w", newline="", encoding="utf-8") as fh:
        scrittore = csv.writer(fh)
        scrittore.writerow(
            ["istat", "comune", "provincia", "anno", "tema", "voce", "valore"]
        )
        scrittore.writerows(sorted(osservazioni))

    # Riepilogo della copertura, per accorgersi subito di un buco.
    copertura: dict[tuple[str, int], set[str]] = defaultdict(set)
    for istat, _, _, anno, tema, _, _ in osservazioni:
        copertura[(tema, anno)].add(istat)

    print(f"\n-> clean/{destinazione.name}: {len(osservazioni)} osservazioni")
    print("   copertura per tema e anno:")
    for chiave in sorted(copertura):
        tema, anno = chiave
        print(f"     {tema:15} {anno}  {len(copertura[chiave])} comuni")

    mancano = [
        f"{tema} {anno}"
        for (tema, anno), comuni in sorted(copertura.items())
        if len(comuni) < len(geo)
    ]
    if mancano:
        print(f"   ! copertura incompleta su: {', '.join(mancano)}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
