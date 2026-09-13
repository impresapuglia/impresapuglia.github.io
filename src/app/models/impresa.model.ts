/**
 * Modelli relativi alla dimensione "impresa": settori merceologici,
 * serie storiche trimestrali e metriche derivate.
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

/** Numero di imprese per settore in un comune. */
export type SettoriBreakdown = Record<SettoreKey, number>;

/** Punto della serie storica trimestrale. */
export interface TrendTrimestrale {
  /** Etichetta del trimestre, es. "Q3-2025". */
  trimestre: string;
  /** Imprese registrate totali a fine trimestre. */
  totale: number;
  /** Di cui imprese femminili. */
  femminili: number;
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
export type MetricaMappa = 'densita' | 'femminili' | 'giovanili';
