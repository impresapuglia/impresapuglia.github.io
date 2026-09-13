"""
01_download.py — scarica i dataset grezzi da dati.puglia.it (portale CKAN).

Strategia: invece di inseguire URL fissi (che sul portale cambiano), si
interroga l'API CKAN, si filtrano le risorse in formato CSV/XLS e si salva
ogni file in raw/ con un nome parlante:

    raw/<tema>_<PROVINCIA>_<PERIODO>__<slug-risorsa>.csv
    es. raw/femminili_LE_Q4-2017__imprese-femminili-lecce.csv

Il periodo e la provincia sono dedotti dal titolo del dataset quando presenti
(molte serie della Camera di Commercio sono trimestrali e provinciali).

Uso:
    python 01_download.py                 # tutte le ricerche in config.py
    python 01_download.py --solo-noti     # solo i dataset gia verificati
    python 01_download.py --dry-run       # elenca senza scaricare
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from config import (
    CKAN_API,
    DATASET_NOTI,
    FORMATI_ACCETTATI,
    PROVINCIA_DA_TITOLO,
    RAW,
    RICERCHE,
    TIMEOUT,
    USER_AGENT,
)

ROMANI = {"i": 1, "ii": 2, "iii": 3, "iv": 4}


def senza_accenti(testo: str) -> str:
    nfkd = unicodedata.normalize("NFKD", testo)
    return "".join(c for c in nfkd if not unicodedata.combining(c)).lower()


def slugify(testo: str, max_len: int = 60) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", senza_accenti(testo)).strip("-")
    return s[:max_len] or "risorsa"


def http_json(url: str) -> dict:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def scarica(url: str, destinazione: Path) -> bool:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            dati = resp.read()
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as err:
        print(f"    ! download fallito: {err}")
        return False
    destinazione.write_bytes(dati)
    print(f"    -> {destinazione.name} ({len(dati) / 1024:.0f} KB)")
    return True


def deduci_provincia(titolo: str) -> str:
    t = senza_accenti(titolo)
    for chiave, sigla in PROVINCIA_DA_TITOLO.items():
        if chiave in t:
            return sigla
    return "PUG"  # dato regionale


def deduci_periodo(titolo: str) -> str:
    """Estrae un periodo tipo Q4-2017 o 2021 dal titolo del dataset."""
    t = senza_accenti(titolo)
    anno = re.search(r"(20\d{2})", t)
    anno_s = anno.group(1) if anno else "NA"

    trim = re.search(r"\b(i{1,3}|iv)\s*trim", t)
    if trim:
        return f"Q{ROMANI[trim.group(1)]}-{anno_s}"
    trim2 = re.search(r"([1-4])\s*(?:°|deg)?\s*trimestre", t)
    if trim2:
        return f"Q{trim2.group(1)}-{anno_s}"
    return anno_s


def risorse_del_dataset(slug: str) -> tuple[str, list[dict]]:
    url = f"{CKAN_API}/package_show?{urllib.parse.urlencode({'id': slug})}"
    dati = http_json(url)
    if not dati.get("success"):
        raise RuntimeError(f"package_show fallito per {slug}")
    pkg = dati["result"]
    return pkg.get("title", slug), pkg.get("resources", [])


def cerca(query: str, rows: int = 40) -> list[dict]:
    params = urllib.parse.urlencode({"q": query, "rows": rows})
    dati = http_json(f"{CKAN_API}/package_search?{params}")
    if not dati.get("success"):
        return []
    return dati["result"].get("results", [])


def salva_risorse(tema: str, titolo: str, risorse: list[dict], dry: bool) -> int:
    provincia = deduci_provincia(titolo)
    periodo = deduci_periodo(titolo)
    salvate = 0

    for r in risorse:
        fmt = (r.get("format") or "").strip().lower()
        if fmt not in FORMATI_ACCETTATI:
            continue
        url = r.get("url")
        if not url:
            continue

        nome = f"{tema}_{provincia}_{periodo}__{slugify(r.get('name') or titolo)}.{fmt}"
        destinazione = RAW / nome

        if destinazione.exists():
            print(f"    = gia presente: {nome}")
            salvate += 1
            continue
        if dry:
            print(f"    ? {nome}  <- {url}")
            salvate += 1
            continue
        if scarica(url, destinazione):
            salvate += 1

    return salvate


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--solo-noti", action="store_true",
                        help="scarica solo i dataset elencati in DATASET_NOTI")
    parser.add_argument("--dry-run", action="store_true",
                        help="mostra cosa verrebbe scaricato, senza scaricare")
    args = parser.parse_args()

    RAW.mkdir(parents=True, exist_ok=True)
    totale = 0

    print("== Dataset verificati ==")
    for slug, tema in DATASET_NOTI.items():
        print(f"  [{tema}] {slug}")
        try:
            titolo, risorse = risorse_del_dataset(slug)
        except Exception as err:  # noqa: BLE001 — il portale puo essere giu
            print(f"    ! {err}")
            continue
        totale += salva_risorse(tema, titolo, risorse, args.dry_run)

    if not args.solo_noti:
        print("\n== Ricerca sul portale ==")
        visti: set[str] = set(DATASET_NOTI)
        for tema, query in RICERCHE:
            print(f"  [{tema}] '{query}'")
            try:
                risultati = cerca(query)
            except Exception as err:  # noqa: BLE001
                print(f"    ! ricerca fallita: {err}")
                continue
            for pkg in risultati:
                slug = pkg.get("name", "")
                if slug in visti:
                    continue
                visti.add(slug)
                titolo = pkg.get("title", slug)
                print(f"    · {titolo}")
                totale += salva_risorse(tema, titolo, pkg.get("resources", []),
                                        args.dry_run)

    print(f"\nFile in raw/: {totale}")
    if totale == 0:
        print("Nessun file scaricato. Verifica la connessione o il portale.")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
