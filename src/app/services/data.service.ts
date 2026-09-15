import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { forkJoin, tap } from 'rxjs';

import {
  ComuneData,
  DatasetImprese,
  META_VUOTO,
  MetaDataset,
  PugliaGeoJson,
  StatisticheRegionali,
} from '../models/comune.model';
import { SETTORI, SettoreKey } from '../models/impresa.model';

/**
 * Carica i due dataset statici dell'app e li espone come signals:
 * - src/assets/data/imprese.json   ({ meta, comuni }, dalla pipeline Python)
 * - src/assets/data/puglia.geojson (confini comunali ISTAT)
 *
 * Il caricamento avviene una sola volta: le chiamate successive a `load()`
 * sono no-op, cosi mappa principale e mappa opportunita condividono i dati.
 */
@Injectable({ providedIn: 'root' })
export class DataService {
  private readonly http = inject(HttpClient);

  private readonly _comuni = signal<ComuneData[]>([]);
  private readonly _meta = signal<MetaDataset>(META_VUOTO);
  private readonly _geo = signal<PugliaGeoJson | null>(null);
  private readonly _loading = signal(false);
  private readonly _error = signal<string | null>(null);
  private caricato = false;

  /** Elenco dei comuni, ordinato alfabeticamente. */
  readonly comuni = this._comuni.asReadonly();
  /** Anni di riferimento del dataset, per etichette e guida. */
  readonly meta = this._meta.asReadonly();
  /** FeatureCollection dei confini comunali. */
  readonly geo = this._geo.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly error = this._error.asReadonly();
  /** True quando entrambi i dataset sono disponibili. */
  readonly pronto = computed(
    () => this._comuni().length > 0 && this._geo() !== null,
  );

  /** Indice codice ISTAT -> comune, per il join veloce con il GeoJSON. */
  readonly perIstat = computed(() => {
    const map = new Map<string, ComuneData>();
    for (const c of this._comuni()) map.set(c.istat, c);
    return map;
  });

  /** Statistiche regionali usate da legenda, gap settoriali e sintesi. */
  readonly statistiche = computed<StatisticheRegionali>(() => {
    const comuni = this._comuni();
    const vuoto = SETTORI.reduce(
      (acc, s) => ({ ...acc, [s]: 0 }),
      {} as Record<SettoreKey, number>,
    );

    if (comuni.length === 0) {
      return {
        comuni: 0,
        totaleImprese: 0,
        totaleAddetti: 0,
        popolazione: 0,
        densitaMedia: 0,
        densitaMin: 0,
        densitaMax: 0,
        dimensioneMedia: 0,
        natalitaMedia: 0,
        saldoMedio: 0,
        quotaMediaSettore: { ...vuoto },
        mediaSettore: { ...vuoto },
      };
    }

    let totaleImprese = 0;
    let totaleAddetti = 0;
    let popolazione = 0;
    let sommaDensita = 0;
    let sommaNatalita = 0;
    let sommaSaldo = 0;
    let densitaMin = Number.POSITIVE_INFINITY;
    let densitaMax = Number.NEGATIVE_INFINITY;
    const sommaSettore = { ...vuoto };
    const sommaQuote = { ...vuoto };

    for (const c of comuni) {
      totaleImprese += c.totale_imprese;
      totaleAddetti += c.addetti;
      popolazione += c.popolazione;
      sommaDensita += c.densita_imprenditoriale;
      sommaNatalita += c.tasso_natalita;
      sommaSaldo += c.saldo_demografico;
      densitaMin = Math.min(densitaMin, c.densita_imprenditoriale);
      densitaMax = Math.max(densitaMax, c.densita_imprenditoriale);
      for (const s of SETTORI) {
        const v = c.settori[s] ?? 0;
        sommaSettore[s] += v;
        sommaQuote[s] += c.totale_imprese ? v / c.totale_imprese : 0;
      }
    }

    const mediaSettore = { ...vuoto };
    const quotaMediaSettore = { ...vuoto };
    for (const s of SETTORI) {
      mediaSettore[s] = sommaSettore[s] / comuni.length;
      quotaMediaSettore[s] = sommaQuote[s] / comuni.length;
    }

    return {
      comuni: comuni.length,
      totaleImprese,
      totaleAddetti,
      popolazione,
      densitaMedia: sommaDensita / comuni.length,
      densitaMin,
      densitaMax,
      // Rapporto fra i totali regionali, non media delle medie comunali: la
      // seconda darebbe lo stesso peso a Bari e a Celle di San Vito.
      dimensioneMedia: totaleImprese ? totaleAddetti / totaleImprese : 0,
      natalitaMedia: sommaNatalita / comuni.length,
      saldoMedio: sommaSaldo / comuni.length,
      quotaMediaSettore,
      mediaSettore,
    };
  });

  /** I venti comuni con la densita imprenditoriale piu alta. */
  readonly topDensita = computed(() =>
    [...this._comuni()]
      .sort((a, b) => b.densita_imprenditoriale - a.densita_imprenditoriale)
      .slice(0, 20),
  );

  /** Carica i dataset (una sola volta per sessione). */
  load(): void {
    if (this.caricato || this._loading()) return;
    this._loading.set(true);
    this._error.set(null);

    forkJoin({
      dataset: this.http.get<DatasetImprese>('assets/data/imprese.json'),
      geo: this.http.get<PugliaGeoJson>('assets/data/puglia.geojson'),
    })
      .pipe(
        tap({
          error: (err) =>
            console.error('[DataService] caricamento fallito', err),
        }),
      )
      .subscribe({
        next: ({ dataset, geo }) => {
          const comuni = dataset?.comuni ?? [];
          this._comuni.set(
            [...comuni].sort((a, b) => a.comune.localeCompare(b.comune, 'it')),
          );
          this._meta.set(dataset?.meta ?? META_VUOTO);
          this._geo.set(geo);
          this._loading.set(false);
          this.caricato = true;
        },
        error: () => {
          this._error.set(
            'Non è stato possibile caricare i dati. Verifica che i file in assets/data siano presenti e ricarica la pagina.',
          );
          this._loading.set(false);
        },
      });
  }

  /** Comune corrispondente a un codice ISTAT, se presente nel dataset. */
  perCodice(istat: string): ComuneData | undefined {
    return this.perIstat().get(istat);
  }
}
