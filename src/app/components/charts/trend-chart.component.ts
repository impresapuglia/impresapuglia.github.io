import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';
import {
  CategoryScale,
  Chart,
  Filler,
  Legend,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip,
  TooltipItem,
} from 'chart.js';

import { TrendAnnuale } from '../../models/impresa.model';
import { TemaService } from '../../services/tema.service';

Chart.register(
  LineController,
  LineElement,
  PointElement,
  LinearScale,
  CategoryScale,
  Filler,
  Legend,
  Tooltip,
);

const NF = new Intl.NumberFormat('it-IT');
const NF1 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Andamento annuale, in numero indice con base 100 al primo anno della serie.
 *
 * In valore assoluto le due serie stanno su ordini di grandezza diversi (gli
 * addetti sono circa il triplo delle imprese) e un solo asse le schiaccerebbe
 * entrambe in due rette piatte; due assi separati sarebbero peggio, perché
 * farebbero sembrare confrontabili scale che non lo sono. Ribasare a 100 mette
 * le due serie sulla stessa scala — quella delle variazioni — che è poi la
 * cosa che interessa: se gli addetti crescono mentre le imprese calano, il
 * tessuto si sta concentrando, e su due assi assoluti non si vedrebbe.
 */
@Component({
  selector: 'app-trend-chart',
  standalone: true,
  template: `
    <div class="relative h-56 w-full">
      <canvas #canvas aria-label="Andamento annuale di imprese e addetti, base 100"></canvas>
    </div>
  `,
})
export class TrendChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly tema = inject(TemaService);

  @ViewChild('canvas', { static: true })
  canvas!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) trend!: TrendAnnuale[];

  private chart?: Chart<'line'>;

  constructor() {
    // Il grafico non sa leggere i token: al cambio tema va ricostruito.
    effect(() => {
      this.tema.tema();
      if (this.chart) {
        this.chart.destroy();
        this.chart = undefined;
        this.crea();
      }
    });
  }

  ngAfterViewInit(): void {
    this.crea();
  }

  ngOnChanges(): void {
    if (this.chart) this.aggiorna();
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
  }

  private crea(): void {
    const ctx = this.canvas.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart = new Chart(ctx, {
      type: 'line',
      data: this.datiGrafico(),
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              boxWidth: 10,
              boxHeight: 10,
              font: { size: 11 },
              color: this.tema.colore('ink-soft'),
              padding: 12,
              usePointStyle: true,
              pointStyle: 'rectRounded',
            },
          },
          tooltip: {
            backgroundColor: this.tema.colore('shell'),
            borderColor: this.tema.colore('shell-3'),
            borderWidth: 1,
            padding: 10,
            titleColor: '#FFFFFF',
            bodyColor: this.tema.colore('ink-dim'),
            callbacks: {
              label: (item: TooltipItem<'line'>) => {
                const assoluti = this.assoluti(item.datasetIndex);
                const v = assoluti[item.dataIndex] ?? 0;
                const unita = item.datasetIndex === 0 ? 'imprese' : 'addetti';
                return ` ${item.dataset.label}: ${NF1.format(item.parsed.y)} (${NF.format(v)} ${unita})`;
              },
            },
          },
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: this.tema.colore('line') },
            ticks: { font: { size: 10 }, color: this.tema.colore('ink-soft') },
          },
          y: {
            grid: { color: this.tema.colore('line', 0.5) },
            border: { display: false },
            ticks: {
              font: { size: 10 },
              color: this.tema.colore('ink-soft'),
              maxTicksLimit: 6,
              callback: (v) => NF1.format(Number(v)),
            },
          },
        },
      },
    });
  }

  private aggiorna(): void {
    if (!this.chart) return;
    this.chart.data = this.datiGrafico();
    this.chart.update();
  }

  private assoluti(dataset: number): number[] {
    const serie = this.trend ?? [];
    return dataset === 0
      ? serie.map((t) => t.imprese)
      : serie.map((t) => t.addetti);
  }

  /** Ribasa una serie a 100 sul primo valore non nullo. */
  private indice(valori: number[]): number[] {
    const base = valori.find((v) => v > 0) ?? 0;
    if (!base) return valori.map(() => 100);
    return valori.map((v) => (v / base) * 100);
  }

  private datiGrafico() {
    const serie = this.trend ?? [];
    return {
      labels: serie.map((t) => String(t.anno)),
      datasets: [
        {
          label: 'Imprese attive',
          data: this.indice(serie.map((t) => t.imprese)),
          borderColor: this.tema.colore('brand'),
          backgroundColor: this.tema.colore('brand', 0.1),
          borderWidth: 2,
          pointRadius: 3,
          pointBorderWidth: 2,
          pointBorderColor: this.tema.colore('card'),
          pointBackgroundColor: this.tema.colore('brand'),
          tension: 0.3,
          fill: false,
        },
        {
          label: 'Addetti',
          data: this.indice(serie.map((t) => t.addetti)),
          borderColor: this.tema.colore('gold'),
          backgroundColor: this.tema.colore('gold', 0.1),
          borderWidth: 2,
          pointRadius: 3,
          pointBorderWidth: 2,
          pointBorderColor: this.tema.colore('card'),
          pointBackgroundColor: this.tema.colore('gold'),
          tension: 0.3,
          fill: false,
        },
      ],
    };
  }
}
