import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

import { ComuneData } from '../models/comune.model';
import { MetricaMappa, ProvinciaKey } from '../models/impresa.model';

/** Stato corrente dei filtri applicati alla mappa. */
export interface FilterState {
  /** null = tutte le province. */
  provincia: ProvinciaKey | null;
  /** Colora la mappa sulla quota di imprese femminili. */
  soloFemminili: boolean;
  /** Colora la mappa sulla quota di imprese giovanili. */
  soloGiovanili: boolean;
  /** Nasconde i comuni sotto questa soglia di imprese totali (0-500). */
  sogliaMinima: number;
}

export const FILTRI_INIZIALI: FilterState = {
  provincia: null,
  soloFemminili: false,
  soloGiovanili: false,
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
    const prossimo = { ...this._filtri$.value, ...parziale };

    // I due toggle di metrica sono mutuamente esclusivi: attivarne uno
    // spegne l'altro, altrimenti la scala colori non sarebbe interpretabile.
    if (parziale.soloFemminili === true) prossimo.soloGiovanili = false;
    if (parziale.soloGiovanili === true) prossimo.soloFemminili = false;

    this._filtri$.next(prossimo);
  }

  setProvincia(provincia: ProvinciaKey | null): void {
    this.patch({ provincia });
  }

  setSogliaMinima(sogliaMinima: number): void {
    this.patch({ sogliaMinima });
  }

  reset(): void {
    this._filtri$.next({ ...FILTRI_INIZIALI });
  }

  /** Metrica su cui va colorata la mappa in base ai toggle attivi. */
  static metrica(f: FilterState): MetricaMappa {
    if (f.soloFemminili) return 'femminili';
    if (f.soloGiovanili) return 'giovanili';
    return 'densita';
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
      f.soloFemminili ||
      f.soloGiovanili ||
      f.sogliaMinima > 0
    );
  }
}
