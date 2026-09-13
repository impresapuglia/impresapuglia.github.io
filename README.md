# ImpresaPuglia

Web app interattiva sull'imprenditoria pugliese: mappa choropleth dei 257 comuni,
pannello di dettaglio con grafici e mappa delle opportunità settoriali.

**Stack:** Angular 19 (standalone components + signals) · Tailwind CSS · Leaflet ·
Chart.js · TypeScript strict · deploy su Vercel.

---

## Avvio rapido

```bash
npm install
npm start          # http://localhost:4200
```

Build di produzione:

```bash
npm run build
```

Il progetto **non fa alcuna chiamata a servizi esterni a pagamento** e non
richiede nessuna chiave API. L'unico host contattato è Google Fonts: la mappa
non carica tile da nessun provider.

---

## Stato dei dati

| Cosa | Stato |
| --- | --- |
| `src/assets/data/puglia.geojson` | **reale** — confini dei 257 comuni pugliesi (ISTAT, via openpolis/geojson-italy), semplificati al 18% con mapshaper |
| `src/assets/data/imprese.json` | **dimostrativo** — generato da `data-pipeline/00_generate_mock.py` |

I valori imprenditoriali sono sintetici e deterministici (seed fisso): servono a
sviluppare mappa e grafici prima del collegamento ai dati reali. Sono plausibili
nell'ordine di grandezza ma **non vanno citati come dati ufficiali**. La UI lo
dichiara nel pannello di dettaglio.

Per rigenerarli:

```bash
npm run data:mock
```

### Passare ai dati reali

La pipeline in `data-pipeline/` attinge al portale CKAN della Regione Puglia
([dati.puglia.it](https://dati.puglia.it/ckan)):

```bash
pip install -r data-pipeline/requirements.txt
python data-pipeline/01_download.py --dry-run   # elenca cosa scaricherebbe
python data-pipeline/01_download.py             # -> data-pipeline/raw/
python data-pipeline/02_clean.py                # -> data-pipeline/clean/osservazioni.csv
python data-pipeline/03_aggregate.py            # -> src/assets/data/imprese.json
```

Oppure `npm run data:pipeline` per i tre passi in fila.

Note operative:

- I dataset comunali su imprese femminili e giovanili sul portale sono
  pubblicati **per provincia e per trimestre**, e la copertura più ricca è
  quella della Camera di Commercio di Lecce. Le province non coperte usciranno
  con valori a zero: `02_clean.py` segnala i comuni non riconosciuti.
- Per la densità imprenditoriale serve la popolazione comunale. Metti un
  `data-pipeline/clean/popolazione.csv` con colonne `istat,popolazione`
  (fonte ISTAT), altrimenti `03_aggregate.py` lascia la densità a 0.
- `01_download.py` interroga l'API CKAN invece di usare URL fissi, perché gli
  indirizzi delle risorse sul portale cambiano.

---

## Struttura

```
src/app/
├── components/
│   ├── welcome/             pagina di benvenuto (rotta "/")
│   ├── guida/               guida alla lettura e fonti dei dati
│   ├── map/                 mappa choropleth Leaflet
│   ├── comune-panel/        pannello dettaglio comune
│   ├── charts/              grafici Chart.js (barre settori, indice trend)
│   ├── chatbot/             segnaposto assistente ("l'AI arriverà presto")
│   ├── logo/                marchio inline
│   ├── filter-panel/        filtri sidebar
│   ├── opportunity-map/     mappa opportunità
│   └── map-page/            vista che unisce mappa + pannello
├── services/
│   ├── data.service.ts      caricamento dataset + statistiche regionali
│   ├── map.service.ts       scale colore, stili, tooltip, legenda
│   ├── filter.service.ts    stato filtri (BehaviorSubject)
│   ├── sintesi.service.ts   sintesi testuale del comune, calcolata in locale
│   └── ui.service.ts        comune selezionato, apertura pannello assistente
├── models/
│   ├── impresa.model.ts     settori, province, etichette, trend
│   └── comune.model.ts      ComuneData + helper di dominio
├── app.component.ts/html    shell: navbar, sidebar, router-outlet, FAB
│                            (sidebar e FAB solo sulle viste di mappa)
└── app.routes.ts            "/" benvenuto · "/mappa" · "/opportunita" · "/guida"
```

---

## Le pagine

Il sito parte dalla **pagina di benvenuto** (`/`): marchio, titolo e due porte
d'accesso — *Esplora la mappa* e *Cos'è ImpresaPuglia*. Niente sidebar dei
filtri, niente bottone dell'assistente: quelli compaiono solo sulle viste di
mappa, dove servono.

La **guida** (`/guida`) è la spiegazione completa: cosa misura il colore,
perché le classi sono a quantili, cosa fanno i filtri, come si leggono i
cinque blocchi del pannello comune, come si calcola il gap della mappa
opportunità, quali dataset alimentano l'app e quali limiti hanno. Include
l'elenco delle fonti con link diretto a ciascun dataset e lo stato di
collegamento di ognuna.

Le rotte sono `"/"`, `"/mappa"`, `"/opportunita"`, `"/guida"`; qualunque altro
percorso reindirizza alla home.

## Identità visiva e temi

L'app ha **due temi**, chiaro e scuro, entrambi nella stessa famiglia verde:
cambia la direzione della luce, non la tinta. L'interruttore sta nella barra in
alto; all'avvio vince la scelta salvata in `localStorage`, e in mancanza di
quella la preferenza di sistema (`prefers-color-scheme`).

Il colore **non** vive nelle classi: ogni token è una variabile CSS definita in
`src/styles.scss`, una coppia di valori per tema, e `tailwind.config.js` la
avvolge in `rgb(var(--c-x) / <alpha-value>)`. I template restano identici nei
due temi — cambia il valore sotto. Le utility con opacità (`bg-up/10`) continuano
a funzionare.

I token semantici: `canvas` (tela della mappa), `shell` / `shell-2` / `shell-3`
(navbar e intestazioni forti), `panel` (sidebar filtri e sfondo della guida),
`surface`, `card`, `line`, `ink` / `ink-soft` / `ink-dim`, `brand` / `brand-2` /
`brand-ink`, `mint` / `mint-pale`, `gold` / `gold-ink` / `gold-2` / `gold-pale`,
`up` / `down`.

Chart.js non sa leggere i token: `TemaService.colore()` legge il valore corrente
dal `computedStyle` e i due grafici si ricostruiscono al cambio tema.

### Le scale della mappa si invertono con il tema

Su tela scura il valore alto è quello che **accende** il comune; su tela chiara
è quello che lo **scurisce**. Tenere la stessa rampa in entrambi i temi farebbe
sparire metà dei comuni nel fondo, quindi `MapService` ne espone due coppie e
sceglie in base al tema attivo.

Tutte e quattro sono costruite a luminosità OKLCH equispaziata e verificate per
monotonia, distanza fra i passi adiacenti e contrasto della classe più vicina
alla tela.

| | scuro | chiaro |
| --- | --- | --- |
| tela | `#0B2018` | `#E7F1E9` |
| densità (basso → alto) | `#00653e` → `#95e9bf` | `#61b98f` → `#003814` |
| opportunità | `#694e00` → `#ecd28b` | `#bda258` → `#3d2300` |

### Marchio

Il marchio (`public/logo.svg`, e `LogoComponent` per l'uso in app) è una tessera
verde con la sagoma della Puglia — generata dal GeoJSON reale, semplificata —
e tre barre oro ascendenti. Le barre reggono il marchio sotto i 32px, dove la
sola sagoma, che è una fascia diagonale sottile, diventa illeggibile. In
`public/` ci sono anche i lockup orizzontali per fondo chiaro e scuro.

## Come funziona la mappa

La mappa **non carica tile**: disegna solo i confini comunali su una tela
piena. Niente etichette del basemap, niente resto d'Italia, nessuna dipendenza
da un provider esterno — e nessun watermark quando quel provider cambia le sue
condizioni, che è esattamente quello che è successo con CARTO.

`densita_imprenditoriale` è un valore reale (imprese ogni 1.000 abitanti,
tipicamente 60–135), non una scala 0–100. Le classi sono a **quantili**: il
colore si sceglie sul rango percentuale del comune nella distribuzione, non su
un intervallo costante. La densità si distribuisce attorno alla media, quindi a
intervalli costanti quasi tutti i comuni finirebbero nelle due classi centrali e
la mappa uscirebbe monocroma.

La distribuzione si calcola sui comuni che superano i filtri, non sull'intera
regione: filtrando una provincia la scala si ricalcola e resta leggibile.

I toggle "solo femminili" / "solo giovanili" cambiano la metrica di
colorazione (quota % invece della densità); la soglia minima non nasconde i
comuni ma li spegne, fuori dalla scala colori.

### Mappa opportunità

Il gap non è la differenza fra valore comunale e media regionale assoluta —
penalizzerebbe sistematicamente i comuni piccoli. È la differenza rispetto
alla **quota attesa**: se in Puglia un settore vale in media il 12% delle
imprese di un comune, un comune con 1.000 imprese dovrebbe averne circa 120;
quante ne mancano è il gap. I comuni già sopra la quota media restano al
colore più chiaro.

---

## I due grafici del pannello

**Imprese per settore** è un grafico a barre orizzontali ordinate, non una
torta: sette fette sono troppe da confrontare a occhio. Un solo colore, perché
il settore è già scritto sull'asse — la lunghezza porta il dato, il colore non
deve ricodificarlo. I valori sono etichettati direttamente in fondo a ogni barra.

**Andamento trimestrale** è in numero indice con base 100 al primo trimestre.
In valore assoluto le due serie stanno su ordini di grandezza diversi (le
femminili sono circa un quarto del totale) e su un asse solo si schiacciano
entrambe in due rette piatte; due assi separati sarebbero peggio, perché
farebbero sembrare confrontabili scale che non lo sono. Ribasare a 100 mette le
serie sulla stessa scala, quella delle variazioni.

## Sintesi del comune

Il riquadro "Sintesi" nel pannello di dettaglio è generato da
`SintesiService`: tre frasi (punto di forza, criticità, opportunità) scelte
confrontando i valori del comune con le medie regionali già calcolate da
`DataService`. È codice TypeScript puro — nessuna rete, nessuna chiave,
nessun costo, e lo stesso comune produce sempre lo stesso testo.

## Assistente conversazionale

Rimosso. Il bottone flottante in basso a destra apre un riquadro che avvisa
che la funzione arriverà più avanti. Nel progetto non resta nessun client
HTTP verso servizi di modelli, nessun prompt e nessuna variabile d'ambiente
con chiavi.

Se un domani lo si reintroduce, la chiave **non** va messa in
`environment.ts`: in un'app solo frontend finisce compilata in chiaro nel
bundle JavaScript che il browser scarica, e una variabile d'ambiente su
Vercel non cambia niente (protegge solo dal commit nel repository). La strada
corretta è una funzione serverless in `api/` che tiene la chiave lato server.

---

## Fonti

- Confini comunali: ISTAT, tramite [openpolis/geojson-italy](https://github.com/openpolis/geojson-italy)
- Dati imprenditoriali: [Open Data Regione Puglia](https://dati.puglia.it/ckan) — dataset
  "Imprese per comune e settore di attività economica" e serie trimestrali della
  Camera di Commercio di Lecce (CC BY 4.0)
- Basemap: OpenStreetMap / CARTO
