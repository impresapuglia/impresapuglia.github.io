import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { PROVINCE } from '../../models/impresa.model';
import { DataService } from '../../services/data.service';
import {
  FILTRI_INIZIALI,
  FilterService,
  FilterState,
} from '../../services/filter.service';

/**
 * Riepilogo della selezione corrente, appoggiato sopra la mappa.
 *
 * Esiste solo sotto `lg`, e per una ragione geometrica: la Puglia e piu larga
 * che alta (circa 1,27:1) mentre lo schermo di un telefono e verticale
 * (0,67:1). Inquadrando la regione restano quindi ~180px vuoti sopra la
 * sagoma e ~150 sotto, il 56% dell'area mappa. Questa card occupa quel vuoto
 * invece di sottrarre spazio alla mappa. Su schermi larghi gli stessi numeri
 * stanno gia nella sidebar dei filtri, quindi qui sparisce.
 */
@Component({
  selector: 'app-riepilogo',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div
      class="pointer-events-none rounded-xl border border-shell-3 bg-shell/95 px-3.5 py-2.5 backdrop-blur-sm"
      role="status"
    >
      <div class="flex items-baseline justify-between gap-2">
        <p class="truncate text-[10px] font-semibold uppercase tracking-wider2 text-mint">
          {{ titolo() }}
        </p>
        @if (anno()) {
          <p class="shrink-0 text-[10px] tabular-nums text-ink-dim">{{ anno() }}</p>
        }
      </div>

      <dl class="mt-1.5 grid grid-cols-3 gap-2">
        <div class="min-w-0">
          <dd class="truncate text-base font-semibold leading-none tabular-nums text-white">
            {{ comuni() | number: '1.0-0' }}
          </dd>
          <dt class="mt-0.5 truncate text-[10px] text-ink-dim">comuni</dt>
        </div>
        <div class="min-w-0">
          <dd class="truncate text-base font-semibold leading-none tabular-nums text-mint-pale">
            {{ imprese() | number: '1.0-0' }}
          </dd>
          <dt class="mt-0.5 truncate text-[10px] text-ink-dim">imprese attive</dt>
        </div>
        <div class="min-w-0">
          <dd class="truncate text-base font-semibold leading-none tabular-nums text-mint-pale">
            {{ addetti() | number: '1.0-0' }}
          </dd>
          <dt class="mt-0.5 truncate text-[10px] text-ink-dim">addetti</dt>
        </div>
      </dl>
    </div>
  `,
})
export class RiepilogoComponent {
  private readonly data = inject(DataService);
  private readonly filterService = inject(FilterService);
  private readonly destroyRef = inject(DestroyRef);

  private readonly filtri = signal<FilterState>({ ...FILTRI_INIZIALI });

  constructor() {
    this.filterService.filtri$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) => this.filtri.set(f));
  }

  /** Comuni che superano i filtri correnti. */
  private readonly selezione = computed(() => {
    const f = this.filtri();
    return this.data.comuni().filter((c) => FilterService.passa(c, f));
  });

  readonly comuni = computed(() => this.selezione().length);

  readonly imprese = computed(() =>
    this.selezione().reduce((a, c) => a + c.totale_imprese, 0),
  );

  readonly addetti = computed(() =>
    this.selezione().reduce((a, c) => a + c.addetti, 0),
  );

  readonly anno = computed(() => this.data.meta().anno_imprese || null);

  /** "Puglia" oppure il nome esteso della provincia filtrata. */
  readonly titolo = computed(() => {
    const sigla = this.filtri().provincia;
    if (!sigla) return 'Puglia';
    return PROVINCE.find((p) => p.code === sigla)?.label ?? sigla;
  });
}
