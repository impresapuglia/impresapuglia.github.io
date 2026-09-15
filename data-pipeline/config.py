"""
Configurazione condivisa dalla pipeline dati.

Portali interrogati:
  - Open Data Regione Puglia (CKAN) — https://dati.puglia.it/ckan
  - Open Data IPRES (CKAN)          — http://www.opendataipres.it
    IPRES e l'istituto di ricerca della Regione Puglia; i suoi dataset sono
    referenziati dalle schede di dati.puglia.it.
Licenza dei dataset usati: CC BY 4.0 (verificare sulla scheda di ogni dataset).

Popolazione comunale: ISTAT, Censimento permanente 2021.
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

# Popolazione residente per comune, censimento ISTAT 2021.
# Colonne: pro_com_t (codice ISTAT a 6 cifre), pop_res_21.
URL_POPOLAZIONE = (
    "https://raw.githubusercontent.com/opendatasicilia/comuni-italiani/"
    "main/dati/popolazione_2021.csv"
)

# Ricerche usate da 01_download.py per esplorare il portale.
#
# ATTENZIONE: package_search di CKAN spezza la query in token e li combina in
# OR, quindi restituisce anche dataset che non c'entrano nulla (la query sulla
# nati-mortalita riporta una trentina di tavole sulle assunzioni, che
# contengono "imprese" e "pugliesi" e tanto basta). Queste ricerche servono
# per esplorare il portale, non per alimentare la pipeline: il lavoro vero si
# fa su DATASET_NOTI, con `--solo-noti`.
RICERCHE = [
    ("imprese", "imprese per comune e settore di attivita economica"),
    ("imprese", "imprese attive e addetti a livello comunale"),
    ("femminili", "imprese femminili comuni provincia"),
    ("giovanili", "imprese giovanili comuni provincia"),
    ("unita_locali", "unita locali delle imprese per comune"),
    ("natimortalita", "nati-mortalita delle imprese pugliesi"),
    ("straniere", "imprese individuali imprenditori extracomunitari comuni"),
]

# Dataset verificati a mano: scaricati sempre, anche se la ricerca cambia.
# (slug CKAN -> tema interno)
DATASET_NOTI = {
    "imprese-per-comune-e-settore-di-attivita-economica": "imprese",
    "unita-locali-delle-imprese-per-comune-e-settore-di-attivita-economica": "unita_locali",
    "imprese-attive-e-addetti-in-puglia-a-livello-comunale-anni-2020-e-20211": "imprese",
    "nati-mortalita-delle-imprese-pugliesi": "natimortalita",
}

FORMATI_ACCETTATI = {"csv", "xls", "xlsx"}

# A parita di nome risorsa il portale pubblica spesso la stessa tabella in due
# formati. Scaricarne entrambi porterebbe 02_clean.py a leggere due volte gli
# stessi numeri e a sommarli: si tiene un solo formato, nell'ordine.
PREFERENZA_FORMATI = ["csv", "xlsx", "xls"]

# --- sorgenti effettivamente usate da 02_clean.py -------------------------
#
# Ogni voce: (sottostringa del nome file in raw/, tema, layout).
# Layout "matrice_ateco": Province, Comuni, Anni + una colonna per sezione
#                         ATECO (il valore e imprese o addetti).
# Layout "natimortalita": Province, Comuni + Registrate, Attive, Iscrizioni,
#                         Cessazioni; l'anno sta nel nome del file.
# L'ORDINE CONTA: "imprese-attive-dal-2020-al-2024" e una sottostringa di
# "addetti-alle-imprese-attive-dal-2020-al-2024", quindi il pattern degli
# addetti va confrontato per primo, altrimenti gli addetti finiscono
# etichettati come imprese.
SORGENTI = [
    ("addetti-alle-imprese-attive-dal-2020-al-2024", "addetti", "matrice_ateco"),
    ("imprese-attive-dal-2020-al-2024", "imprese", "matrice_ateco"),
    ("natimortalita_", "natimortalita", "natimortalita"),
]

# File presenti in raw/ ma deliberatamente ignorati, con il motivo. 02_clean.py
# li salta in silenzio: sono scaricati perche stanno nello stesso dataset CKAN.
IGNORATI = {
    "imprese-per-comune-e-settore-di-attivita-economica":
        "contiene solo l'anno 2011 (censimento), non utilizzabile come dato corrente",
    "unita-locali-delle-imprese-per-comune-e-settore":
        "contiene solo l'anno 2011",
    "imprese-per-settore-anni-2020-2021":
        "sottoinsieme di imprese-attive-dal-2020-al-2024",
    "addetti-per-settore-anni-2020-e-2021":
        "sottoinsieme di addetti-alle-imprese-attive-dal-2020-al-2024",
    "imprese-per-divisione":
        "disaggregazione per divisione ATECO, piu fine di quella che serve",
    "addetti-per-divisione":
        "disaggregazione per divisione ATECO, piu fine di quella che serve",
    "forma-giuridica":
        "dimensione non usata dall'app",
    "imprese-e-addetti-dal-2020-al-2024":
        "xlsx con gli stessi numeri dei due CSV per settore",
}

# --- province -------------------------------------------------------------

PROVINCE = ["BA", "BAT", "BR", "FG", "LE", "TA"]

# Denominazioni provinciali usate nei CSV -> sigla.
SIGLA_PROVINCIA = {
    "bari": "BA",
    "barletta-andria-trani": "BAT",
    "barletta andria trani": "BAT",
    "bat": "BAT",
    "brindisi": "BR",
    "foggia": "FG",
    "lecce": "LE",
    "taranto": "TA",
}

# Riconoscimento della provincia dal titolo di un dataset (usato in download).
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

# --- nomi dei comuni ------------------------------------------------------
#
# Differenze fra come il comune e scritto nei CSV e come lo scrive l'ISTAT nel
# GeoJSON. Chiave e valore vanno gia normalizzati (minuscolo, senza accenti).
#
# "castelluccio" da solo compare nel 2020 e nel 2021 e diventa "castelluccio
# valmaggiore" dal 2022: e lo stesso comune, e NON va confuso con
# "castelluccio dei sauri", che nei file c'e per conto suo.
#
# L'apostrofo finale (NARDO', PATU', SECLI') e gestito da una regola generale
# in 02_clean.py, non qui: in italiano non esistono comuni il cui nome finisce
# davvero per apostrofo, e sempre un accento troncato da chi ha digitato in
# maiuscolo.
ALIAS_COMUNE = {
    "castelluccio": "castelluccio valmaggiore",
}

# Righe che non sono comuni: totali di colonna in fondo alla tabella.
NON_COMUNI = {"totale", "totali", "puglia", "totale puglia", "totale regione"}

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

# Le 21 colonne per sezione ATECO dei file IPRES -> i sette settori dell'app.
# Il confronto e su nome colonna normalizzato (minuscolo, senza accenti,
# underscore e spazi compattati), perche il portale scrive indifferentemente
# "Attività_servizi_alloggio" e "Attivita_professionali_scientifiche " con lo
# spazio finale.
COLONNE_ATECO = {
    "agricoltura": "agricoltura",
    "estrazione minerali": "manifatturiero",
    "attivita manifatturiere": "manifatturiero",
    "fornitura energia elettrica": "manifatturiero",
    "fornitura acqua": "manifatturiero",
    "costruzioni": "costruzioni",
    "commercio ingrosso dettaglio": "commercio",
    "commercio ingrosso detaglio": "commercio",  # errore di battitura nel file
    "attivita servizi alloggio": "turismo_ristorazione",
    "servizi informazione": "servizi_professionali",
    "attivita finanziarie assicurative": "servizi_professionali",
    "attivita immobiliari": "servizi_professionali",
    "attivita professionali scientifiche": "servizi_professionali",
    "attivita professionali": "servizi_professionali",
    "noleggio agenzie viaggio": "servizi_professionali",
    "noleggio agenzie": "servizi_professionali",
    "trasporto magazzinaggio": "altro",
    "amministrazione pubblica": "altro",
    "istruzione": "altro",
    "sanita": "altro",
    "attivita artistiche sportive": "altro",
    "altre attivita servizi": "altro",
    "attivita famiglie convivenze": "altro",
    "imprese non classificate": "altro",
}

# Misure del file nati-mortalita -> nome canonico interno.
COLONNE_NATIMORTALITA = {
    "registrate": "registrate",
    "attive": "attive",
    "iscrizioni": "iscrizioni",
    "cessazioni": "cessazioni",
    "cessazioni non d'ufficio": "cessazioni_non_ufficio",
}

# --- anni di riferimento --------------------------------------------------

# Anno piu recente della serie imprese/addetti: e quello che l'app mostra come
# fotografia corrente.
ANNO_CORRENTE = 2024
# Anno piu recente disponibile per la nati-mortalita.
ANNO_NATIMORTALITA = 2023
# Anno del censimento da cui viene la popolazione.
ANNO_POPOLAZIONE = 2021
