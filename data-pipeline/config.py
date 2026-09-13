"""
Configurazione condivisa dalla pipeline dati.

Portale: Open Data Regione Puglia (CKAN) — https://dati.puglia.it/ckan
Licenza dei dataset usati: CC BY 4.0 (verificare sulla scheda di ogni dataset).
"""

from pathlib import Path

# --- percorsi -------------------------------------------------------------

BASE = Path(__file__).resolve().parent
RAW = BASE / "raw"
CLEAN = BASE / "clean"
ASSETS = BASE.parent / "src" / "assets" / "data"
GEOJSON = ASSETS / "puglia.geojson"
OUTPUT_JSON = ASSETS / "imprese.json"

# --- portale CKAN ---------------------------------------------------------

CKAN_BASE = "https://dati.puglia.it/ckan"
CKAN_API = f"{CKAN_BASE}/api/3/action"
USER_AGENT = "ImpresaPuglia/1.0 (progetto didattico; open data Regione Puglia)"
TIMEOUT = 60

# Ricerche usate da 01_download.py per scoprire i dataset sul portale.
# Ogni voce: (tema interno, query CKAN).
RICERCHE = [
    ("imprese", "imprese per comune e settore di attivita economica"),
    ("imprese", "imprese attive e addetti a livello comunale"),
    ("femminili", "imprese femminili comuni provincia"),
    ("giovanili", "imprese giovanili comuni provincia"),
    ("unita_locali", "unita locali delle imprese per comune"),
    ("natimortalita", "nati-mortalita delle imprese pugliesi"),
    ("straniere", "imprese individuali imprenditori extracomunitari comuni"),
]

# Dataset gia verificati a mano: scaricati sempre, anche se la ricerca cambia.
# (slug CKAN -> tema interno)
DATASET_NOTI = {
    "imprese-per-comune-e-settore-di-attivita-economica": "imprese",
    "unita-locali-delle-imprese-per-comune-e-settore-di-attivita-economica": "unita_locali",
    "imprese-attive-e-addetti-in-puglia-a-livello-comunale-anni-2020-e-20211": "imprese",
    "nati-mortalita-delle-imprese-pugliesi": "natimortalita",
}

FORMATI_ACCETTATI = {"csv", "xls", "xlsx"}

# --- province -------------------------------------------------------------

PROVINCE = ["BA", "BAT", "BR", "FG", "LE", "TA"]

# Riconoscimento della provincia dal titolo del dataset.
PROVINCIA_DA_TITOLO = {
    "lecce": "LE",
    "bari": "BA",
    "taranto": "TA",
    "foggia": "FG",
    "brindisi": "BR",
    "barletta": "BAT",
    "andria": "BAT",
    "trani": "BAT",
    "bat": "BAT",
}

# --- settori --------------------------------------------------------------

SETTORI = [
    "agricoltura",
    "manifatturiero",
    "costruzioni",
    "commercio",
    "turismo_ristorazione",
    "servizi_professionali",
    "altro",
]

# Mappatura dalle descrizioni ATECO 2007 usate dal portale ai sette settori
# dell'app. Il confronto e su sottostringa, in minuscolo e senza accenti.
ATECO_A_SETTORE = [
    ("agricoltura", "agricoltura"),
    ("silvicoltura", "agricoltura"),
    ("pesca", "agricoltura"),
    ("estrazione", "manifatturiero"),
    ("attivita manifatturiere", "manifatturiero"),
    ("manifattur", "manifatturiero"),
    ("fornitura di energia", "manifatturiero"),
    ("fornitura di acqua", "manifatturiero"),
    ("costruzioni", "costruzioni"),
    ("commercio", "commercio"),
    ("alloggio", "turismo_ristorazione"),
    ("ristorazione", "turismo_ristorazione"),
    ("servizi di alloggio", "turismo_ristorazione"),
    ("agenzie di viaggio", "turismo_ristorazione"),
    ("attivita professionali", "servizi_professionali"),
    ("scientifiche e tecniche", "servizi_professionali"),
    ("servizi di informazione", "servizi_professionali"),
    ("attivita finanziarie", "servizi_professionali"),
    ("assicurative", "servizi_professionali"),
    ("attivita immobiliari", "servizi_professionali"),
    ("noleggio", "servizi_professionali"),
]

# Nomi di colonna possibili nei CSV del portale -> nome canonico interno.
ALIAS_COLONNE = {
    "comune": "comune",
    "territorio": "comune",
    "denominazione comune": "comune",
    "descrizione comune": "comune",
    "provincia": "provincia",
    "sigla provincia": "provincia",
    "anno": "anno",
    "periodo": "anno",
    "trimestre": "trimestre",
    "ateco 2007": "ateco",
    "ateco": "ateco",
    "settore": "ateco",
    "settore di attivita economica": "ateco",
    "divisione": "ateco",
    "numero imprese": "valore",
    "imprese": "valore",
    "n. imprese": "valore",
    "numero": "valore",
    "valore": "valore",
    "registrate": "valore",
    "attive": "valore",
    "addetti": "addetti",
    "popolazione": "popolazione",
    "codice istat": "istat",
    "cod istat": "istat",
    "pro com": "istat",
    "procom": "istat",
}
