/**
 * Modelli relativi alla dimensione "impresa": settori merceologici, serie
 * storica annuale e metriche derivate.
 */

/** Chiavi dei settori merceologici usati dal dataset aggregato. */
export type SettoreKey =
  | 'agricoltura'
  | 'manifatturiero'
  | 'costruzioni'
  | 'commercio'
  | 'turismo_ristorazione'
  | 'servizi_professionali'
  | 'altro';

/** Elenco ordinato dei settori: unica fonte di verita per cicli e grafici. */
export const SETTORI: readonly SettoreKey[] = [
  'agricoltura',
  'manifatturiero',
  'costruzioni',
  'commercio',
  'turismo_ristorazione',
  'servizi_professionali',
  'altro',
] as const;

/** Etichette leggibili dei settori, per UI e tooltip. */
export const SETTORE_LABEL: Readonly<Record<SettoreKey, string>> = {
  agricoltura: 'Agricoltura',
  manifatturiero: 'Manifatturiero',
  costruzioni: 'Costruzioni',
  commercio: 'Commercio',
  turismo_ristorazione: 'Turismo e ristorazione',
  servizi_professionali: 'Servizi professionali',
  altro: 'Altro',
};

/**
 * Sezioni ATECO 2007 che finiscono in ciascun settore dell'app. Serve alla
 * guida: senza questo elenco "Altro" al 30% sembra un errore, mentre e la
 * somma di trasporti, istruzione, sanita e servizi alla persona.
 */
export const SETTORE_COMPOSIZIONE: Readonly<Record<SettoreKey, string>> = {
  agricoltura: 'Agricoltura, silvicoltura e pesca',
  manifatturiero:
    'Attività manifatturiere, estrazione di minerali, fornitura di energia, acqua e gestione rifiuti',
  costruzioni: 'Costruzioni',
  commercio: 'Commercio all’ingrosso e al dettaglio, riparazione di autoveicoli',
  turismo_ristorazione: 'Servizi di alloggio e ristorazione',
  servizi_professionali:
    'Attività professionali e scientifiche, informazione e comunicazione, finanza e assicurazioni, immobiliare, noleggio e agenzie di viaggio',
  altro:
    'Trasporto e magazzinaggio, istruzione, sanità e assistenza sociale, attività artistiche e sportive, altri servizi, amministrazione pubblica, imprese non classificate',
};

/** Numero di imprese per settore in un comune. */
export type SettoriBreakdown = Record<SettoreKey, number>;

/** Punto della serie storica annuale. */
export interface TrendAnnuale {
  /** Anno di riferimento, es. 2024. */
  anno: number;
  /** Imprese attive a fine anno. */
  imprese: number;
  /** Addetti alle imprese attive. */
  addetti: number;
}

/** Sigle provinciali pugliesi. */
export type ProvinciaKey = 'BA' | 'BAT' | 'BR' | 'FG' | 'LE' | 'TA';

/** Elenco delle province con etichetta estesa, per i filtri. */
export const PROVINCE: readonly { code: ProvinciaKey; label: string }[] = [
  { code: 'BA', label: 'Bari' },
  { code: 'BAT', label: 'Barletta-Andria-Trani' },
  { code: 'BR', label: 'Brindisi' },
  { code: 'FG', label: 'Foggia' },
  { code: 'LE', label: 'Lecce' },
  { code: 'TA', label: 'Taranto' },
] as const;

/** Metrica su cui e colorata la mappa choropleth. */
export type MetricaMappa = 'densita' | 'dimensione' | 'natalita';

/**
 * Descrittore di una metrica di colorazione: etichetta, unita di misura e
 * spiegazione. Tenerle qui evita che legenda, filtri, pannello e guida
 * scrivano ciascuno la propria versione dello stesso testo.
 */
export interface DescrittoreMetrica {
  code: MetricaMappa;
  /** Etichetta lunga, per la legenda. */
  label: string;
  /** Etichetta corta, per i bottoni dei filtri. */
  breve: string;
  /** Unita da accodare ai valori nella legenda. */
  suffisso: string;
  /** Una frase che dice cosa misura e come si legge. */
  descrizione: string;
}

export const METRICHE: readonly DescrittoreMetrica[] = [
  {
    code: 'densita',
    label: 'Densità imprenditoriale',
    breve: 'Densità',
    suffisso: '',
    descrizione:
      'Imprese attive ogni 1.000 abitanti. Misura quanto tessuto produttivo c’è in rapporto a chi vive nel comune, e permette di confrontare un capoluogo con un paese di duemila abitanti.',
  },
  {
    code: 'dimensione',
    label: 'Dimensione media d’impresa',
    breve: 'Dimensione',
    suffisso: ' add.',
    descrizione:
      'Addetti per impresa attiva. Distingue i comuni con poche imprese strutturate da quelli con molte microimprese: due comuni con lo stesso numero di imprese possono avere economie molto diverse.',
  },
  {
    code: 'natalita',
    label: 'Tasso di natalità d’impresa',
    breve: 'Natalità',
    suffisso: '%',
    descrizione:
      'Nuove iscrizioni in un anno ogni 100 imprese registrate. È il ricambio del tessuto produttivo: dice dove si apre, non dove si è già aperto.',
  },
] as const;

export const METRICA_LABEL: Readonly<Record<MetricaMappa, string>> = {
  densita: 'Densità imprenditoriale',
  dimensione: 'Dimensione media d’impresa',
  natalita: 'Tasso di natalità d’impresa',
};

/** Descrittore di una metrica, per chiave. */
export function descrittore(metrica: MetricaMappa): DescrittoreMetrica {
  return METRICHE.find((m) => m.code === metrica) ?? METRICHE[0];
}
