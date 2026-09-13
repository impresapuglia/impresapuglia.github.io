"""
00_generate_mock.py — genera dati DIMOSTRATIVI per lo sviluppo del frontend.

ATTENZIONE: i numeri prodotti da questo script NON sono dati reali.
Sono valori sintetici, deterministici (seed fisso), plausibili nell'ordine di
grandezza, usati per sviluppare mappa/grafici prima che la pipeline reale
(01_download -> 02_clean -> 03_aggregate) sia collegata a dati.puglia.it.

Input : src/assets/data/puglia.geojson  (confini comunali reali, ISTAT/openpolis)
Output: src/assets/data/imprese.json    (dati sintetici nel formato di progetto)

Uso: python 00_generate_mock.py
"""

import json
import math
import random
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
GEOJSON = ROOT / "src" / "assets" / "data" / "puglia.geojson"
OUTPUT = ROOT / "src" / "assets" / "data" / "imprese.json"

SETTORI = [
    "agricoltura",
    "manifatturiero",
    "costruzioni",
    "commercio",
    "turismo_ristorazione",
    "servizi_professionali",
    "altro",
]

# Pesi settoriali per provincia: FG agricola, BA/BT manifatturiera,
# LE/BR a vocazione turistica, TA industriale.
PESI_PROVINCIA = {
    "FG": [0.26, 0.07, 0.11, 0.24, 0.09, 0.06, 0.17],
    "BA": [0.09, 0.12, 0.13, 0.28, 0.09, 0.11, 0.18],
    "BAT": [0.14, 0.13, 0.13, 0.26, 0.08, 0.08, 0.18],
    "TA": [0.13, 0.10, 0.13, 0.26, 0.10, 0.08, 0.20],
    "BR": [0.15, 0.07, 0.12, 0.25, 0.14, 0.08, 0.19],
    "LE": [0.11, 0.08, 0.12, 0.26, 0.16, 0.09, 0.18],
}

# Popolazioni note dei principali comuni (ordine di grandezza reale),
# usate per ancorare la generazione dei valori sintetici.
POP_NOTE = {
    "Bari": 315000, "Taranto": 187000, "Foggia": 145000, "Andria": 99000,
    "Lecce": 95000, "Barletta": 94000, "Brindisi": 85000, "Altamura": 70000,
    "Molfetta": 58000, "Cerignola": 56000, "Trani": 55000, "Bitonto": 55000,
    "Bisceglie": 54000, "Manfredonia": 54000, "San Severo": 51000,
    "Monopoli": 49000, "Corato": 47000, "Gravina in Puglia": 42000,
    "Martina Franca": 46000, "Ruvo di Puglia": 25000, "Fasano": 38000,
    "Nardò": 31000, "Galatina": 26000, "Gallipoli": 20000, "Ostuni": 31000,
    "Massafra": 32000, "Grottaglie": 31000, "Francavilla Fontana": 35000,
    "Mesagne": 26000, "Casarano": 20000, "Copertino": 23000,
    "Putignano": 26000, "Modugno": 37000, "Bitritto": 11000,
    "Terlizzi": 26000, "Giovinazzo": 20000, "Conversano": 26000,
    "Noicattaro": 27000, "Triggiano": 27000, "Mola di Bari": 25000,
    "Lucera": 32000, "Trinitapoli": 13000, "Canosa di Puglia": 29000,
    "Ceglie Messapica": 19000, "Otranto": 5800, "Polignano a Mare": 18000,
    "Alberobello": 10000, "Vieste": 13000, "Peschici": 4300,
}


def centroide(geometry):
    """Centroide area-pesato dell'anello esterno piu grande (no dipendenze)."""
    if geometry["type"] == "Polygon":
        anelli = [geometry["coordinates"][0]]
    else:  # MultiPolygon
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
        return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
    return migliore


def area_kmq(geometry):
    """Area approssimata in km^2 (proiezione equirettangolare locale)."""
    if geometry["type"] == "Polygon":
        polys = [geometry["coordinates"]]
    else:
        polys = geometry["coordinates"]

    lat_rif = math.radians(41.0)
    km_per_grado_lat = 111.32
    km_per_grado_lon = 111.32 * math.cos(lat_rif)

    totale = 0.0
    for poly in polys:
        anello = poly[0]
        a = 0.0
        for i in range(len(anello) - 1):
            x0 = anello[i][0] * km_per_grado_lon
            y0 = anello[i][1] * km_per_grado_lat
            x1 = anello[i + 1][0] * km_per_grado_lon
            y1 = anello[i + 1][1] * km_per_grado_lat
            a += x0 * y1 - x1 * y0
        totale += abs(a) * 0.5
    return totale


def main():
    if not GEOJSON.exists():
        raise SystemExit(f"GeoJSON non trovato: {GEOJSON}")

    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    rng = random.Random(20260906)  # seed fisso -> output riproducibile

    comuni = []
    for feat in geo["features"]:
        props = feat["properties"]
        nome = props["nome"]
        prov = props["prov"]
        lng, lat = centroide(feat["geometry"])
        superficie = area_kmq(feat["geometry"])

        # --- popolazione sintetica ---
        if nome in POP_NOTE:
            pop = POP_NOTE[nome]
        else:
            # log-normale ancorata alla superficie: comuni grandi tendono a
            # essere piu popolosi, con forte dispersione.
            base = 260 * max(superficie, 3.0) ** 0.72
            pop = int(base * math.exp(rng.gauss(0.0, 0.55)))
            pop = max(400, min(pop, 45000))

        # --- imprese registrate ---
        # rapporto imprese/abitanti tipico del Mezzogiorno: 8-11%
        rapporto = min(max(rng.gauss(0.094, 0.013), 0.062), 0.135)
        totale = max(40, int(round(pop * rapporto)))

        pct_f = min(max(rng.gauss(0.245, 0.030), 0.170), 0.330)
        pct_g = min(max(rng.gauss(0.098, 0.022), 0.045), 0.165)
        femminili = int(round(totale * pct_f))
        giovanili = int(round(totale * pct_g))

        # densita imprenditoriale = imprese ogni 1.000 abitanti
        densita = round(totale / pop * 1000, 1)

        # --- distribuzione settoriale ---
        pesi = PESI_PROVINCIA.get(prov, PESI_PROVINCIA["BA"])
        rumore = [max(0.02, p * rng.gauss(1.0, 0.18)) for p in pesi]
        somma = sum(rumore)
        settori, assegnate = {}, 0
        for i, chiave in enumerate(SETTORI[:-1]):
            v = int(round(totale * rumore[i] / somma))
            settori[chiave] = v
            assegnate += v
        settori["altro"] = max(0, totale - assegnate)

        # --- trend 8 trimestri, terminante sui valori correnti ---
        crescita = rng.gauss(0.020, 0.032)  # crescita complessiva sui 2 anni
        trend = []
        etichette = [f"Q{q}-{a}" for a in (2024, 2025) for q in (1, 2, 3, 4)]
        for i, et in enumerate(etichette):
            k = (i - 7) / 7.0  # -1 al primo trimestre, 0 all'ultimo
            fattore = 1.0 + crescita * k
            trend.append({
                "trimestre": et,
                "totale": totale if i == 7 else int(round(totale * fattore)),
                "femminili": femminili if i == 7 else int(round(femminili * (1.0 + (crescita + 0.010) * k))),
            })

        comuni.append({
            "comune": nome,
            "provincia": prov,
            "istat": props["istat"],
            "popolazione": pop,
            "superficie_kmq": round(superficie, 1),
            "totale_imprese": totale,
            "imprese_femminili": femminili,
            "imprese_giovanili": giovanili,
            "densita_imprenditoriale": densita,
            "settori": settori,
            "trend_trimestrale": trend,
            "lat": round(lat, 4),
            "lng": round(lng, 4),
        })

    comuni.sort(key=lambda c: c["comune"])
    OUTPUT.write_text(json.dumps(comuni, ensure_ascii=False), encoding="utf-8")

    tot = sum(c["totale_imprese"] for c in comuni)
    dens = [c["densita_imprenditoriale"] for c in comuni]
    print(f"Scritti {len(comuni)} comuni in {OUTPUT}")
    print(f"Imprese totali (sintetiche): {tot:,}")
    print(f"Densita min/max: {min(dens)} / {max(dens)}")


if __name__ == "__main__":
    main()
