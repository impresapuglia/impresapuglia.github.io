"""
02_clean.py — normalizza i file grezzi in un unico formato tabellare.

Cosa fa:
  1. legge ogni file di raw/ (CSV o XLS/XLSX), provando piu separatori e
     codifiche, perche i file del portale non sono omogenei;
  2. rinomina le colonne sul vocabolario canonico di config.ALIAS_COLONNE;
  3. standardizza i nomi dei comuni (minuscolo, senza accenti, senza suffissi
     tipo " (LE)") e li riconcilia con l'elenco ufficiale letto dal GeoJSON;
  4. mappa le descrizioni ATECO sui sette settori dell'app;
  5. imputa i valori mancanti con la media provinciale.

Output: clean/osservazioni.csv con colonne
    tema, provincia, periodo, comune, istat, settore, valore

Uso: python 02_clean.py
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from pathlib import Path

import pandas as pd

try:
    from unidecode import unidecode
except ImportError:  # fallback: unicodedata basta per l'italiano
    def unidecode(testo: str) -> str:  # type: ignore[misc]
        nfkd = unicodedata.normalize("NFKD", testo)
        return "".join(c for c in nfkd if not unicodedata.combining(c))

from config import ALIAS_COLONNE, ATECO_A_SETTORE, CLEAN, GEOJSON, RAW

SEPARATORI = [",", ";", "\t", "|"]
CODIFICHE = ["utf-8-sig", "utf-8", "latin-1"]


# --------------------------------------------------------------------------
# Normalizzazione testuale
# --------------------------------------------------------------------------

def norm(testo: object) -> str:
    """minuscolo, senza accenti, spazi compattati."""
    s = unidecode(str(testo)).lower().strip()
    return re.sub(r"\s+", " ", s)


def norm_comune(testo: object) -> str:
    """Come norm(), ma toglie la sigla provinciale e la punteggiatura."""
    s = norm(testo)
    s = re.sub(r"\s*\((?:[a-z]{2}|[^)]*)\)\s*$", "", s)  # "Nardò (LE)" -> "nardo"
    s = s.replace("'", " ").replace("-", " ").replace(".", " ")
    s = re.sub(r"\s+", " ", s).strip()
    return s


def settore_da_ateco(descrizione: object) -> str:
    d = norm(descrizione)
    for chiave, settore in ATECO_A_SETTORE:
        if chiave in d:
            return settore
    return "altro"


# --------------------------------------------------------------------------
# Lettura tollerante dei file grezzi
# --------------------------------------------------------------------------

def leggi(percorso: Path) -> pd.DataFrame | None:
    if percorso.suffix.lower() in {".xls", ".xlsx"}:
        try:
            return pd.read_excel(percorso)
        except Exception as err:  # noqa: BLE001
            print(f"    ! Excel illeggibile ({err})")
            return None

    for codifica in CODIFICHE:
        for sep in SEPARATORI:
            try:
                df = pd.read_csv(percorso, sep=sep, encoding=codifica,
                                 dtype=str, engine="python")
            except Exception:  # noqa: BLE001
                continue
            if df.shape[1] > 1:
                return df
    print("    ! nessuna combinazione separatore/codifica ha funzionato")
    return None


def rinomina_colonne(df: pd.DataFrame) -> pd.DataFrame:
    mappa = {}
    for col in df.columns:
        chiave = norm(col)
        if chiave in ALIAS_COLONNE:
            mappa[col] = ALIAS_COLONNE[chiave]
        else:
            # match parziale: "numero imprese registrate" -> valore
            for alias, canonico in ALIAS_COLONNE.items():
                if alias in chiave:
                    mappa[col] = canonico
                    break
    return df.rename(columns=mappa)


# --------------------------------------------------------------------------
# Anagrafica comuni dal GeoJSON (fonte di verita per nomi e codici ISTAT)
# --------------------------------------------------------------------------

def anagrafica() -> dict[str, tuple[str, str, str]]:
    """chiave normalizzata -> (nome ufficiale, sigla provincia, codice ISTAT)."""
    if not GEOJSON.exists():
        raise SystemExit(f"GeoJSON mancante: {GEOJSON}")
    geo = json.loads(GEOJSON.read_text(encoding="utf-8"))
    out: dict[str, tuple[str, str, str]] = {}
    for feat in geo["features"]:
        p = feat["properties"]
        out[norm_comune(p["nome"])] = (p["nome"], p["prov"], p["istat"])
    return out


# --------------------------------------------------------------------------

def metadati_da_nome(percorso: Path) -> tuple[str, str, str]:
    """raw/<tema>_<PROV>_<PERIODO>__<slug>.csv -> (tema, provincia, periodo)."""
    testa = percorso.stem.split("__", 1)[0]
    pezzi = testa.split("_")
    if len(pezzi) >= 3:
        return pezzi[0], pezzi[1], "_".join(pezzi[2:])
    return testa, "PUG", "NA"


def main() -> int:
    if not RAW.exists() or not any(RAW.iterdir()):
        print("raw/ e vuota: esegui prima 01_download.py")
        return 1

    CLEAN.mkdir(parents=True, exist_ok=True)
    comuni = anagrafica()
    righe: list[pd.DataFrame] = []
    non_riconosciuti: set[str] = set()

    for percorso in sorted(RAW.iterdir()):
        if percorso.suffix.lower() not in {".csv", ".xls", ".xlsx"}:
            continue
        print(f"  {percorso.name}")
        df = leggi(percorso)
        if df is None or df.empty:
            continue

        df = rinomina_colonne(df)
        if "comune" not in df.columns or "valore" not in df.columns:
            print("    ~ saltato: mancano le colonne comune/valore")
            continue

        tema, provincia_file, periodo = metadati_da_nome(percorso)

        out = pd.DataFrame()
        out["comune_norm"] = df["comune"].map(norm_comune)
        out["settore"] = (
            df["ateco"].map(settore_da_ateco) if "ateco" in df.columns else "altro"
        )
        out["valore"] = pd.to_numeric(
            df["valore"].astype(str).str.replace(r"[^\d,.-]", "", regex=True)
            .str.replace(".", "", regex=False)
            .str.replace(",", ".", regex=False),
            errors="coerce",
        )

        # Periodo: preferisci la colonna del file, altrimenti il nome file.
        if "anno" in df.columns:
            out["periodo"] = df["anno"].astype(str).str.strip()
        else:
            out["periodo"] = periodo

        # Join con l'anagrafica ufficiale.
        anag = out["comune_norm"].map(lambda k: comuni.get(k))
        non_riconosciuti.update(
            out.loc[anag.isna(), "comune_norm"].dropna().unique().tolist()
        )
        out = out[anag.notna()].copy()
        anag = anag[anag.notna()]
        out["comune"] = [a[0] for a in anag]
        out["provincia"] = [a[1] for a in anag]
        out["istat"] = [a[2] for a in anag]
        out["tema"] = tema

        righe.append(
            out[["tema", "provincia", "periodo", "comune", "istat",
                 "settore", "valore"]]
        )
        print(f"    ok: {len(out)} righe")

    if not righe:
        print("Nessuna riga utilizzabile.")
        return 1

    tabella = pd.concat(righe, ignore_index=True)

    # Imputazione dei valori mancanti con la media provinciale del settore,
    # con fallback sulla media regionale del settore.
    media_prov = tabella.groupby(["provincia", "settore"])["valore"].transform("mean")
    media_reg = tabella.groupby("settore")["valore"].transform("mean")
    mancanti = tabella["valore"].isna().sum()
    tabella["valore"] = tabella["valore"].fillna(media_prov).fillna(media_reg).fillna(0)
    tabella["valore"] = tabella["valore"].round().astype(int)

    destinazione = CLEAN / "osservazioni.csv"
    tabella.to_csv(destinazione, index=False, encoding="utf-8")

    print(f"\nScritte {len(tabella)} osservazioni in {destinazione}")
    print(f"Valori imputati con la media provinciale: {mancanti}")
    if non_riconosciuti:
        anteprima = ", ".join(sorted(non_riconosciuti)[:12])
        print(f"Comuni non riconosciuti ({len(non_riconosciuti)}): {anteprima} …")
        print("  -> se sono comuni pugliesi, aggiungili come alias in norm_comune().")
    return 0


if __name__ == "__main__":
    sys.exit(main())
