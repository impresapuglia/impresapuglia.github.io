"""
03_aggregate.py — costruisce src/assets/data/imprese.json.

Input : clean/osservazioni.csv (prodotto da 02_clean.py)
        src/assets/data/puglia.geojson (anagrafica, centroidi)
Output: src/assets/data/imprese.json nel formato consumato da DataService.

Cosa calcola per ogni comune:
  - totale imprese = somma delle osservazioni del tema "imprese" nell'ultimo
    periodo disponibile;
  - imprese femminili / giovanili dai temi omonimi (0 se il dataset non
    copre quella provincia);
  - densita imprenditoriale = imprese ogni 1.000 abitanti;
  - distribuzione per settore;
  - serie storica sugli ultimi otto periodi disponibili;
  - lat/lng dal centroide del poligono comunale.

I comuni presenti nel GeoJSON ma assenti dai dataset restano nel file con
valori a zero, cosi la mappa non ha buchi: nel frontend risultano nella
classe piu chiara della scala.

Uso: python 03_aggregate.py
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

from config import CLEAN, GEOJSON, OUTPUT_JSON, SETTORI

# Popolazione: se non e disponibile un dataset demografico si usa questo file
# opzionale (comune;popolazione). Senza di esso la densita non viene calcolata.
POPOLAZIONE_CSV = CLEAN / "popolazione.csv"


def centroide(geometry: dict) -> tuple[float, float]:
    """Centroide area-pesato dell'anello esterno piu grande."""
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
        pts = anelli[0]
        return (sum(p[0] for p in pts) / len(pts),
                sum(p[1] for p in pts) / len(pts))
    return migliore


def ordina_periodi(periodi: list[str]) -> list[str]:
    """Ordina "Q3-2025" / "2021" cronologicamente."""
    def chiave(p: str) -> tuple[int, int]:
        p = str(p)
        if p.startswith("Q") and "-" in p:
            q, anno = p[1:].split("-", 1)
            return (int(anno) if anno.isdigit() else 0,
                    int(q) if q.isdigit() else 0)
        return (int(p) if p.isdigit() else 0, 4)
    return sorted(set(periodi), key=chiave)


def carica_popolazione() -> dict[str, int]:
    if not POPOLAZIONE_CSV.exists():
        return {}
    df = pd.read_csv(POPOLAZIONE_CSV, dtype=str)
    colonne = {c.lower().strip(): c for c in df.columns}
    col_istat = colonne.get("istat")
    col_pop = colonne.get("popolazione")
    if not col_istat or not col_pop:
        return {}
    return {
        str(r[col_istat]).zfill(6): int(float(r[col_pop]))
        for _, r in df.iterrows()
        if str(r[col_pop]).replace(".", "").isdigit()
    }


def main() -> int:
    sorgente = CLEAN / "osservazioni.csv"
    if not sorgente.exists():
        print("clean/osservazioni.csv mancante: esegui prima 02_clean.py")
        return 1
    if not GEOJSON.exists():
        print(f"GeoJSON mancante: {GEOJSON}")
        return 1

    oss = pd.read_csv(sorgente, dtype={"istat": str})
    oss["istat"] = oss["istat"].str.zfill(6)
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    popolazione = carica_popolazione()

    periodi = ordina_periodi(oss["periodo"].astype(str).tolist())
    ultimo = periodi[-1] if periodi else None
    ultimi_otto = periodi[-8:]
    print(f"Periodi disponibili: {len(periodi)} (ultimo: {ultimo})")

    imprese = oss[oss["tema"] == "imprese"]
    femminili = oss[oss["tema"] == "femminili"]
    giovanili = oss[oss["tema"] == "giovanili"]

    # Indici pre-aggregati per lookup veloce.
    tot_per_periodo = (
        imprese.groupby(["istat", "periodo"])["valore"].sum().to_dict()
    )
    fem_per_periodo = (
        femminili.groupby(["istat", "periodo"])["valore"].sum().to_dict()
    )
    gio_ultimo = (
        giovanili[giovanili["periodo"].astype(str) == str(ultimo)]
        .groupby("istat")["valore"].sum().to_dict()
    )
    settori_ultimo = (
        imprese[imprese["periodo"].astype(str) == str(ultimo)]
        .groupby(["istat", "settore"])["valore"].sum().to_dict()
    )

    risultato = []
    senza_dati = 0

    for feat in geo["features"]:
        p = feat["properties"]
        istat = str(p["istat"]).zfill(6)
        lng, lat = centroide(feat["geometry"])

        totale = int(tot_per_periodo.get((istat, ultimo), 0))
        if totale == 0:
            senza_dati += 1

        fem = int(fem_per_periodo.get((istat, ultimo), 0))
        gio = int(gio_ultimo.get(istat, 0))
        pop = popolazione.get(istat, 0)
        densita = round(totale / pop * 1000, 1) if pop else 0.0

        settori = {
            s: int(settori_ultimo.get((istat, s), 0)) for s in SETTORI
        }

        trend = [
            {
                "trimestre": str(per),
                "totale": int(tot_per_periodo.get((istat, per), 0)),
                "femminili": int(fem_per_periodo.get((istat, per), 0)),
            }
            for per in ultimi_otto
        ]

        risultato.append({
            "comune": p["nome"],
            "provincia": p["prov"],
            "istat": istat,
            "popolazione": pop,
            "superficie_kmq": 0.0,
            "totale_imprese": totale,
            "imprese_femminili": fem,
            "imprese_giovanili": gio,
            "densita_imprenditoriale": densita,
            "settori": settori,
            "trend_trimestrale": trend,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
        })

    risultato.sort(key=lambda c: c["comune"])
    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_JSON.write_text(
        json.dumps(risultato, ensure_ascii=False), encoding="utf-8"
    )

    print(f"Scritti {len(risultato)} comuni in {OUTPUT_JSON}")
    print(f"Comuni senza dati nell'ultimo periodo: {senza_dati}")
    if not popolazione:
        print("ATTENZIONE: manca clean/popolazione.csv (colonne istat,popolazione):")
        print("  la densita imprenditoriale resta a 0 e la mappa sara piatta.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
