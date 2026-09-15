"""
03_aggregate.py — costruisce src/assets/data/imprese.json.

Input : clean/osservazioni.csv  (da 02_clean.py)
        clean/popolazione.csv   (da 01b_popolazione.py)
        src/assets/data/puglia.geojson (anagrafica e centroidi)
Output: src/assets/data/imprese.json, nel formato consumato da DataService.

Per ogni comune:
  totale_imprese          imprese attive nell'ultimo anno disponibile (2024)
  addetti                 addetti alle imprese attive, stesso anno
  dimensione_media        addetti / imprese attive
  settori                 le 21 sezioni ATECO riaggregate nei 7 settori dell'app
  popolazione             censimento ISTAT 2021
  densita_imprenditoriale imprese attive ogni 1.000 abitanti
  registrate              imprese registrate (stock) nell'ultimo anno
                          disponibile della nati-mortalita (2023)
  iscrizioni, cessazioni  stesso anno
  tasso_natalita          iscrizioni / registrate * 100
  saldo_demografico       (iscrizioni - cessazioni) / registrate * 100
  trend_annuale           un punto per anno, 2020-2024, con imprese e addetti
  lat, lng                centroide del poligono comunale

Solo libreria standard: nessuna dipendenza, nessuna differenza di
comportamento fra pandas 2.x e 3.x.

Nota sugli anni di riferimento: imprese e addetti arrivano fino al 2024, la
nati-mortalita si ferma al 2023. Sono due rilevazioni diverse della stessa
fonte camerale e non vanno divise fra loro; l'app le mostra etichettate con il
proprio anno.

Uso: python 03_aggregate.py
"""

from __future__ import annotations

import csv
import json
import sys
from collections import defaultdict

from config import (
    ANNO_NATIMORTALITA,
    ANNO_POPOLAZIONE,
    CLEAN,
    GEOJSON,
    OUTPUT_JSON,
    SETTORI,
)


def centroide(geometry: dict) -> tuple[float, float]:
    """Centroide area-pesato dell'anello esterno piu grande. Ritorna (lng, lat)."""
    if geometry["type"] == "Polygon":
        anelli = [geometry["coordinates"][0]]
    else:
        anelli = [poly[0] for poly in geometry["coordinates"]]

    migliore, area_max = None, -1.0
    for anello in anelli:
        a = cx = cy = 0.0
        for i in range(len(anello) - 1):
            x0, y0 = anello[i][0], anello[i][1]
            x1, y1 = anello[i + 1][0], anello[i + 1][1]
            cross = x0 * y1 - x1 * y0
            a += cross
            cx += (x0 + x1) * cross
            cy += (y0 + y1) * cross
        a *= 0.5
        if abs(a) < 1e-12:
            continue
        if abs(a) > area_max:
            area_max = abs(a)
            migliore = (cx / (6 * a), cy / (6 * a))

    if migliore is None:
        punti = anelli[0]
        return (sum(p[0] for p in punti) / len(punti),
                sum(p[1] for p in punti) / len(punti))
    return migliore


def carica_popolazione() -> dict[str, int]:
    percorso = CLEAN / "popolazione.csv"
    if not percorso.exists():
        return {}
    fuori: dict[str, int] = {}
    with percorso.open(encoding="utf-8-sig") as fh:
        for riga in csv.DictReader(fh):
            codice = (riga.get("istat") or "").strip().zfill(6)
            valore = (riga.get("popolazione") or "").strip()
            if codice and valore.isdigit():
                fuori[codice] = int(valore)
    return fuori


def main() -> int:
    sorgente = CLEAN / "osservazioni.csv"
    if not sorgente.exists():
        print("! clean/osservazioni.csv mancante: esegui prima 02_clean.py")
        return 1
    if not GEOJSON.exists():
        print(f"! GeoJSON mancante: {GEOJSON}")
        return 1

    # (tema, istat, anno, voce) -> valore
    valori: dict[tuple[str, str, int, str], int] = {}
    anni_per_tema: dict[str, set[int]] = defaultdict(set)
    with sorgente.open(encoding="utf-8-sig") as fh:
        for riga in csv.DictReader(fh):
            tema = riga["tema"]
            istat = riga["istat"].zfill(6)
            anno = int(riga["anno"])
            valori[(tema, istat, anno, riga["voce"])] = int(riga["valore"])
            anni_per_tema[tema].add(anno)

    anni_imprese = sorted(anni_per_tema.get("imprese", set()))
    anni_nm = sorted(anni_per_tema.get("natimortalita", set()))
    if not anni_imprese:
        print("! nessuna osservazione con tema 'imprese'")
        return 1

    anno_corrente = anni_imprese[-1]
    anno_nm = anni_nm[-1] if anni_nm else ANNO_NATIMORTALITA
    print(f"Imprese e addetti: {anni_imprese[0]}-{anno_corrente} "
          f"({len(anni_imprese)} anni)")
    print(f"Nati-mortalita: ultimo anno {anno_nm}")

    popolazione = carica_popolazione()
    if not popolazione:
        print("! manca clean/popolazione.csv: esegui 01b_popolazione.py, "
              "altrimenti la densita resta a 0 e la mappa sara piatta")

    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))

    def somma(tema: str, istat: str, anno: int) -> int:
        return sum(valori.get((tema, istat, anno, s), 0) for s in SETTORI)

    risultato: list[dict] = []
    senza_imprese: list[str] = []
    senza_popolazione: list[str] = []
    senza_nm: list[str] = []

    for feature in geo["features"]:
        props = feature["properties"]
        istat = str(props["istat"]).zfill(6)
        lng, lat = centroide(feature["geometry"])

        totale = somma("imprese", istat, anno_corrente)
        addetti = somma("addetti", istat, anno_corrente)
        if totale == 0:
            senza_imprese.append(props["nome"])

        pop = popolazione.get(istat, 0)
        if not pop:
            senza_popolazione.append(props["nome"])

        registrate = valori.get(("natimortalita", istat, anno_nm, "registrate"), 0)
        iscrizioni = valori.get(("natimortalita", istat, anno_nm, "iscrizioni"), 0)
        cessazioni = valori.get(("natimortalita", istat, anno_nm, "cessazioni"), 0)
        if registrate == 0:
            senza_nm.append(props["nome"])

        risultato.append({
            "comune": props["nome"],
            "provincia": props["prov"],
            "istat": istat,
            "popolazione": pop,
            "totale_imprese": totale,
            "addetti": addetti,
            "dimensione_media": round(addetti / totale, 2) if totale else 0.0,
            "densita_imprenditoriale": round(totale / pop * 1000, 1) if pop else 0.0,
            "registrate": registrate,
            "iscrizioni": iscrizioni,
            "cessazioni": cessazioni,
            "tasso_natalita": round(iscrizioni / registrate * 100, 2) if registrate else 0.0,
            "saldo_demografico": round((iscrizioni - cessazioni) / registrate * 100, 2) if registrate else 0.0,
            "settori": {
                s: valori.get(("imprese", istat, anno_corrente, s), 0)
                for s in SETTORI
            },
            "trend_annuale": [
                {
                    "anno": anno,
                    "imprese": somma("imprese", istat, anno),
                    "addetti": somma("addetti", istat, anno),
                }
                for anno in anni_imprese
            ],
            "lat": round(lat, 4),
            "lng": round(lng, 4),
        })

    risultato.sort(key=lambda c: c["comune"])

    # Metadati: l'app li mostra nella guida invece di avere gli anni scritti a
    # mano nei template, che è come si finisce con una data sbagliata in pagina.
    meta = {
        "anno_imprese": anno_corrente,
        "anni_trend": anni_imprese,
        "anno_natimortalita": anno_nm,
        "anno_popolazione": ANNO_POPOLAZIONE,
        "comuni": len(risultato),
    }
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(
        json.dumps({"meta": meta, "comuni": risultato}, ensure_ascii=False),
        encoding="utf-8",
    )

    totale_regionale = sum(c["totale_imprese"] for c in risultato)
    addetti_regionali = sum(c["addetti"] for c in risultato)
    print(f"\n-> {OUTPUT_JSON.name}: {len(risultato)} comuni")
    print(f"   imprese attive {anno_corrente}: {totale_regionale:,}".replace(",", "."))
    print(f"   addetti {anno_corrente}:        {addetti_regionali:,}".replace(",", "."))
    print(f"   popolazione {ANNO_POPOLAZIONE}:     "
          f"{sum(c['popolazione'] for c in risultato):,}".replace(",", "."))

    for etichetta, elenco in (
        ("senza imprese", senza_imprese),
        ("senza popolazione", senza_popolazione),
        ("senza nati-mortalita", senza_nm),
    ):
        if elenco:
            print(f"   ! {len(elenco)} comuni {etichetta}: "
                  f"{', '.join(elenco[:8])}"
                  f"{' …' if len(elenco) > 8 else ''}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
