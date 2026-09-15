import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ComuneData } from '../models/comune.model';
import { MetricaMappa, ProvinciaKey } from '../models/impresa.model';

/** Stato corrente dei filtri applicati alla mappa. */
export interface FilterState {
  /** null = tutte le province. */
  provincia: ProvinciaKey | null;
  /** Metrica su cui e colorata la mappa. */
  metrica: MetricaMappa;
  /** Nasconde i comuni sotto questa soglia di imprese attive (0-500). */
  sogliaMinima: number;
}

export const FILTRI_INIZIALI: FilterState = {
  provincia: null,
  metrica: 'densita',
  sogliaMinima: 0,
};

/**
 * Sorgente unica dei filtri. FilterPanelComponent scrive, MapComponent e
 * OpportunityMapComponent leggono, tramite BehaviorSubject cosi che ogni
 * nuovo iscritto riceva subito lo stato corrente.
 */
@Injectable({ providedIn: 'root' })
export class FilterService {
  private readonly _filtri$ = new BehaviorSubject<FilterState>({
    ...FILTRI_INIZIALI,
  });

  /** Stream dei filtri correnti. */
  readonly filtri$ = this._filtri$.asObservable();

  get filtri(): FilterState {
    return this._filtri$.value;
  }

  /** Aggiorna una parte dello stato mantenendo il resto. */
  patch(parziale: Partial<FilterState>): void {
    this._filtri$.next({ ...this._filtri$.value, ...parziale });
  }

  setProvincia(provincia: ProvinciaKey | null): void {
    this.patch({ provincia });
  }

  /**
   * La metrica e una scelta fra tre, non tre interruttori indipendenti: due
   * scale colori sovrapposte sulla stessa mappa non sarebbero leggibili.
   */
  setMetrica(metrica: MetricaMappa): void {
    this.patch({ metrica });
  }

  setSogliaMinima(sogliaMinima: number): void {
    this.patch({ sogliaMinima });
  }

  reset(): void {
    this._filtri$.next({ ...FILTRI_INIZIALI });
  }

  /** True se il comune supera i filtri correnti (provincia + soglia). */
  static passa(c: ComuneData, f: FilterState): boolean {
    if (f.provincia && c.provincia !== f.provincia) return false;
    if (c.totale_imprese < f.sogliaMinima) return false;
    return true;
  }

  /** True se almeno un filtro e diverso dal valore di default. */
  static attivi(f: FilterState): boolean {
    return (
      f.provincia !== null ||
      f.metrica !== FILTRI_INIZIALI.metrica ||
      f.sogliaMinima > 0
    );
  }
}
