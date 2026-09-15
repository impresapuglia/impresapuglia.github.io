import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  Input,
  OnChanges,
  Output,
  SimpleChanges,
  inject,
  signal,
} from '@angular/core';

import {
  ComuneData,
  settoreDominante,
  variazioneAnnua,
  variazionePeriodo,
} from '../../models/comune.model';
import { SETTORE_LABEL, SettoreKey } from '../../models/impresa.model';
import { DataService } from '../../services/data.service';
import { SintesiService } from '../../services/sintesi.service';
import { SectorChartComponent } from '../charts/sector-chart.component';
import { TrendChartComponent } from '../charts/trend-chart.component';

/**
 * FEATURE 2 — Pannello di dettaglio del comune selezionato.
 * KPI, distribuzione settoriale, serie annuale e sintesi calcolata in locale
 * (nessuna chiamata esterna).
 */
@Component({
  selector: 'app-comune-panel',
  standalone: true,
  imports: [CommonModule, SectorChartComponent, TrendChartComponent],
  templateUrl: './comune-panel.component.html',
})
export class ComunePanelComponent implements OnChanges {
  private readonly sintesiService = inject(SintesiService);
  private readonly data = inject(DataService);

  @Input() comune: ComuneData | null = null;

  /** Richiesta di chiusura del pannello. */
  @Output() chiudi = new EventEmitter<void>();

  /** Testo della sintesi del comune corrente. */
  readonly sintesi = signal<string | null>(null);

  readonly meta = this.data.meta;

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['comune']) {
      this.sintesi.set(
        this.comune ? this.sintesiService.perComune(this.comune) : null,
      );
    }
  }

  // -------- metriche derivate esposte al template --------

  get settoreDominante(): SettoreKey | null {
    return this.comune ? settoreDominante(this.comune) : null;
  }

  get settoreDominanteLabel(): string {
    const s = this.settoreDominante;
    return s ? SETTORE_LABEL[s] : '—';
  }

  /** Variazione delle imprese attive fra gli ultimi due anni. */
  get variazioneAnnua(): number {
    return this.comune ? variazioneAnnua(this.comune) : 0;
  }

  /** Variazione su tutta la serie disponibile. */
  get variazionePeriodo(): number {
    return this.comune ? variazionePeriodo(this.comune) : 0;
  }

  /** Scarto percentuale della densita rispetto alla media regionale. */
  get scartoDensita(): number {
    const media = this.data.statistiche().densitaMedia;
    if (!this.comune || !media) return 0;
    return ((this.comune.densita_imprenditoriale - media) / media) * 100;
  }

  /** Primo anno della serie, per l'etichetta della base indice. */
  get annoBase(): number | null {
    const t = this.comune?.trend_annuale;
    return t && t.length ? t[0].anno : null;
  }
}
