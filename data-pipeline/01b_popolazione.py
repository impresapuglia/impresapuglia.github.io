"""
01b_popolazione.py — popolazione residente per comune, necessaria alla densita.

Il portale della Regione Puglia non pubblica la popolazione comunale, quindi si
attinge al dato ISTAT del Censimento permanente 2021, ridistribuito in formato
CSV dal progetto opendatasicilia/comuni-italiani (colonne `pro_com_t`,
`pop_res_21`). La chiave e il codice ISTAT a sei cifre, la stessa usata dal
GeoJSON dei confini: il join e esatto, non per nome.

Uso:
    python 01b_popolazione.py

Produce: clean/popolazione.csv con colonne istat,popolazione (257 righe).
"""

from __future__ import annotations

import csv
import json
import sys
import urllib.error
import urllib.request

from config import CLEAN, GEOJSON, TIMEOUT, URL_POPOLAZIONE, USER_AGENT


def scarica_testo(url: str) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return resp.read().decode("utf-8-sig")


def main() -> int:
    if not GEOJSON.exists():
        print(f"! manca {GEOJSON}")
        return 1

    print(f"Scarico la popolazione ISTAT 2021 da:\n  {URL_POPOLAZIONE}")
    try:
        testo = scarica_testo(URL_POPOLAZIONE)
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError) as err:
        print(f"! download fallito: {err}")
        return 1

    popolazione: dict[str, int] = {}
    for riga in csv.DictReader(testo.splitlines()):
        codice = (riga.get("pro_com_t") or "").strip().zfill(6)
        valore = (riga.get("pop_res_21") or "").strip()
        if codice and valore.isdigit():
            popolazione[codice] = int(valore)
    print(f"  {len(popolazione)} comuni italiani nel file")

    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    righe: list[tuple[str, int]] = []
    mancanti: list[str] = []
    for feature in geo["features"]:
        props = feature["properties"]
        codice = props["istat"]
        if codice in popolazione:
            righe.append((codice, popolazione[codice]))
        else:
            mancanti.append(f"{props['nome']} ({codice})")

    if mancanti:
        print(f"! popolazione mancante per {len(mancanti)} comuni: "
              f"{', '.join(mancanti[:10])}")

    CLEAN.mkdir(parents=True, exist_ok=True)
    destinazione = CLEAN / "popolazione.csv"
    with destinazione.open("w", newline="", encoding="utf-8") as fh:
        scrittore = csv.writer(fh)
        scrittore.writerow(["istat", "popolazione"])
        scrittore.writerows(sorted(righe))

    totale = sum(v for _, v in righe)
    print(f"-> {destinazione.name}: {len(righe)} comuni, "
          f"{totale:,} abitanti".replace(",", "."))
    return 0 if not mancanti else 1


if __name__ == "__main__":
    sys.exit(main())
