import {
  ProvinciaKey,
  SETTORI,
  SettoreKey,
  SettoriBreakdown,
  TrendTrimestrale,
} from './impresa.model';

/**
 * Record di un comune cosi come arriva da src/assets/data/imprese.json,
 * prodotto dalla pipeline Python (data-pipeline/03_aggregate.py).
 */
export interface ComuneData {
  /** Denominazione ufficiale del comune. */
  comune: string;
  /** Sigla provinciale. */
  provincia: ProvinciaKey;
  /** Codice ISTAT a 6 cifre, chiave di join con il GeoJSON. */
  istat: string;
  popolazione: number;
  superficie_kmq: number;
  totale_imprese: number;
  imprese_femminili: number;
  imprese_giovanili: number;
  /** Imprese registrate ogni 1.000 abitanti. */
  densita_imprenditoriale: number;
  settori: SettoriBreakdown;
  /** Otto trimestri, dal piu vecchio al piu recente. */
  trend_trimestrale: TrendTrimestrale[];
  lat: number;
  lng: number;
}

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
  totaleFemminili: number;
  totaleGiovanili: number;
  densitaMedia: number;
  densitaMin: number;
  densitaMax: number;
  /** Media regionale, per settore, della quota sul totale imprese (0-1). */
  quotaMediaSettore: Record<SettoreKey, number>;
  /** Media regionale, per settore, del numero di imprese per comune. */
  mediaSettore: Record<SettoreKey, number>;
}

// --------------------------------------------------------------------------
// Helper di dominio: piccole funzioni pure riusate da componenti e servizi.
// --------------------------------------------------------------------------

/** Percentuale di imprese femminili sul totale (0-100). */
export function pctFemminili(c: ComuneData): number {
  return c.totale_imprese ? (c.imprese_femminili / c.totale_imprese) * 100 : 0;
}

/** Percentuale di imprese giovanili sul totale (0-100). */
export function pctGiovanili(c: ComuneData): number {
  return c.totale_imprese ? (c.imprese_giovanili / c.totale_imprese) * 100 : 0;
}

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

/**
 * Variazione percentuale delle imprese totali sugli ultimi quattro trimestri
 * disponibili (anno su anno). Restituisce 0 se la serie e troppo corta.
 */
export function trendAnnuo(c: ComuneData): number {
  const t = c.trend_trimestrale;
  if (!t || t.length < 5) return 0;
  const ultimo = t[t.length - 1].totale;
  const annoPrima = t[t.length - 5].totale;
  if (!annoPrima) return 0;
  return ((ultimo - annoPrima) / annoPrima) * 100;
}
