import { CommonModule } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';

import { PROVINCE, ProvinciaKey } from '../../models/impresa.model';
import { DataService } from '../../services/data.service';
import {
  FILTRI_INIZIALI,
  FilterService,
  FilterState,
} from '../../services/filter.service';

/**
 * FEATURE 5 — Pannello filtri nella sidebar sinistra.
 * Scrive sul FilterService; mappa e mappa opportunita reagiscono da sole.
 */
@Component({
  selector: 'app-filter-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-panel.component.html',
})
export class FilterPanelComponent {
  private readonly filterService = inject(FilterService);
  private readonly data = inject(DataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly province = PROVINCE;
  readonly statistiche = this.data.statistiche;
  readonly filtri = signal<FilterState>({ ...FILTRI_INIZIALI });

  constructor() {
    this.filterService.filtri$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) => this.filtri.set(f));
  }

  /** Comuni che superano i filtri correnti. */
  get comuniVisibili(): number {
    const f = this.filtri();
    return this.data.comuni().filter((c) => FilterService.passa(c, f)).length;
  }

  /** Imprese totali nei comuni visibili. */
  get impreseVisibili(): number {
    const f = this.filtri();
    return this.data
      .comuni()
      .filter((c) => FilterService.passa(c, f))
      .reduce((a, c) => a + c.totale_imprese, 0);
  }

  get filtriAttivi(): boolean {
    return FilterService.attivi(this.filtri());
  }

  cambiaProvincia(valore: string): void {
    this.filterService.setProvincia(
      valore ? (valore as ProvinciaKey) : null,
    );
  }

  toggleFemminili(): void {
    this.filterService.patch({ soloFemminili: !this.filtri().soloFemminili });
  }

  toggleGiovanili(): void {
    this.filterService.patch({ soloGiovanili: !this.filtri().soloGiovanili });
  }

  cambiaSoglia(valore: string | number): void {
    this.filterService.setSogliaMinima(Number(valore));
  }

  reset(): void {
    this.filterService.reset();
  }
}
