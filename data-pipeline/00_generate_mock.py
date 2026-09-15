"""
00_generate_mock.py — OBSOLETO, non eseguire.

Questo script generava valori imprenditoriali sintetici per sviluppare mappa e
grafici prima del collegamento ai dati reali. Ora src/assets/data/imprese.json
contiene dati reali prodotti dalla pipeline (01 -> 01b -> 02 -> 03) e versionati
nel repository, quindi non serve piu alcun dato finto: chi clona il progetto
trova il file gia pronto.

Lo stub resta solo per non rompere link e riferimenti: il file va cancellato.

    git rm data-pipeline/00_generate_mock.py
"""

import sys

print(__doc__)
sys.exit(1)
