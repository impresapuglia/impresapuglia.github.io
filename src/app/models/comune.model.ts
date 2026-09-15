import {
  ProvinciaKey,
  SETTORI,
  SettoreKey,
  SettoriBreakdown,
  TrendAnnuale,
} from './impresa.model';

/**
 * Record di un comune cosi come arriva da src/assets/data/imprese.json,
 * prodotto dalla pipeline Python (data-pipeline/03_aggregate.py).
 *
 * Tutti i valori sono reali: imprese, addetti e settori vengono dalla serie
 * comunale 2020-2024 pubblicata da IPRES per la Regione Puglia; iscrizioni e
 * cessazioni dal dataset di nati-mortalita; la popolazione dal censimento
 * ISTAT 2021.
 */
export interface ComuneData {
  /** Denominazione ufficiale del comune. */
  comune: string;
  /** Sigla provinciale. */
  provincia: ProvinciaKey;
  /** Codice ISTAT a 6 cifre, chiave di join con il GeoJSON. */
  istat: string;
  /** Popolazione residente al censimento 2021. */
  popolazione: number;
  /** Imprese attive nell'ultimo anno disponibile. */
  totale_imprese: number;
  /** Addetti alle imprese attive, stesso anno. */
  addetti: number;
  /** Addetti per impresa attiva. */
  dimensione_media: number;
  /** Imprese attive ogni 1.000 abitanti. */
  densita_imprenditoriale: number;
  /** Imprese registrate (stock) nell'anno della nati-mortalita. */
  registrate: number;
  /** Nuove iscrizioni nell'anno. */
  iscrizioni: number;
  /** Cessazioni nell'anno. */
  cessazioni: number;
  /** Iscrizioni ogni 100 imprese registrate. */
  tasso_natalita: number;
  /** (iscrizioni - cessazioni) ogni 100 imprese registrate. */
  saldo_demografico: number;
  settori: SettoriBreakdown;
  /** Un punto per anno, dal piu vecchio al piu recente. */
  trend_annuale: TrendAnnuale[];
  lat: number;
  lng: number;
}

/**
 * Anni di riferimento del dataset, scritti dalla pipeline. Stanno nel file
 * invece che nei template perche gli anni cambiano a ogni aggiornamento dei
 * dati, e una data scritta a mano in pagina prima o poi resta indietro.
 */
export interface MetaDataset {
  /** Anno della fotografia corrente di imprese, addetti e settori. */
  anno_imprese: number;
  /** Anni presenti nella serie storica. */
  anni_trend: number[];
  /** Anno di iscrizioni, cessazioni e stock registrate. */
  anno_natimortalita: number;
  /** Anno del censimento da cui viene la popolazione. */
  anno_popolazione: number;
  /** Numero di comuni nel file. */
  comuni: number;
}

/** Contenuto di imprese.json. */
export interface DatasetImprese {
  meta: MetaDataset;
  comuni: ComuneData[];
}

export const META_VUOTO: MetaDataset = {
  anno_imprese: 0,
  anni_trend: [],
  anno_natimortalita: 0,
  anno_popolazione: 0,
  comuni: 0,
};

/** Proprieta presenti su ogni feature di puglia.geojson. */
export interface ComuneGeoProps {
  nome: string;
  prov: ProvinciaKey;
  prov_nome: string;
  istat: string;
}

/** FeatureCollection dei confini comunali pugliesi. */
export type PugliaGeoJson = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  ComuneGeoProps
>;

/** Statistiche aggregate a livello regionale, calcolate una volta sola. */
export interface StatisticheRegionali {
  comuni: number;
  totaleImprese: number;
  totaleAddetti: number;
  popolazione: number;
  /** Media semplice fra comuni della densita. */
  densitaMedia: number;
  densitaMin: number;
  densitaMax: number;
  /** Addetti regionali / imprese regionali: non la media delle medie. */
  dimensioneMedia: number;
  /** Media semplice fra comuni del tasso di natalita. */
  natalitaMedia: number;
  /** Media semplice fra comuni del saldo demografico. */
  saldoMedio: number;
  /** Media regionale, per settore, della quota sul totale imprese (0-1). */
  quotaMediaSettore: Record<SettoreKey, number>;
  /** Media regionale, per settore, del numero di imprese per comune. */
  mediaSettore: Record<SettoreKey, number>;
}

// --------------------------------------------------------------------------
// Helper di dominio: piccole funzioni pure riusate da componenti e servizi.
// --------------------------------------------------------------------------

/** Settore con il maggior numero di imprese, escluso "altro". */
export function settoreDominante(c: ComuneData): SettoreKey {
  let vincitore: SettoreKey = 'commercio';
  let max = -1;
  for (const s of SETTORI) {
    if (s === 'altro') continue;
    const v = c.settori[s] ?? 0;
    if (v > max) {
      max = v;
      vincitore = s;
    }
  }
  return vincitore;
}

/** Quota percentuale di un settore sul totale delle imprese del comune. */
export function quotaSettore(c: ComuneData, s: SettoreKey): number {
  return c.totale_imprese ? ((c.settori[s] ?? 0) / c.totale_imprese) * 100 : 0;
}

/**
 * Variazione percentuale delle imprese attive fra gli ultimi due anni della
 * serie. Zero se la serie e troppo corta o se l'anno di partenza e a zero.
 */
export function variazioneAnnua(c: ComuneData): number {
  const t = c.trend_annuale;
  if (!t || t.length < 2) return 0;
  const ultimo = t[t.length - 1].imprese;
  const precedente = t[t.length - 2].imprese;
  if (!precedente) return 0;
  return ((ultimo - precedente) / precedente) * 100;
}

/** Variazione percentuale delle imprese attive su tutta la serie. */
export function variazionePeriodo(c: ComuneData): number {
  const t = c.trend_annuale;
  if (!t || t.length < 2) return 0;
  const primo = t[0].imprese;
  if (!primo) return 0;
  return ((t[t.length - 1].imprese - primo) / primo) * 100;
}

/** Primo e ultimo anno della serie storica del comune. */
export function estremiSerie(c: ComuneData): [number, number] | null {
  const t = c.trend_annuale;
  if (!t || t.length === 0) return null;
  return [t[0].anno, t[t.length - 1].anno];
}
