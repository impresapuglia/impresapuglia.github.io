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
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  LinearScale,
  Plugin,
  Tooltip,
  TooltipItem,
} from 'chart.js';

import {
  SETTORE_LABEL,
  SETTORI,
  SettoreKey,
  SettoriBreakdown,
} from '../../models/impresa.model';
import { TemaService } from '../../services/tema.service';

Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

const NF = new Intl.NumberFormat('it-IT');

/**
 * Etichetta diretta in fondo a ogni barra: il valore si legge senza passare
 * dal tooltip, che è anche la contropartita richiesta quando il colore del
 * riempimento non raggiunge 3:1 sul fondo bianco.
 */
const etichette: Plugin<'bar'> = {
  id: 'etichetteFineBarra',
  afterDatasetsDraw(chart, _args, opzioni) {
    const { ctx } = chart;
    const colore = (opzioni as { colore?: string })?.colore ?? '#52646E';
    const meta = chart.getDatasetMeta(0);
    const dati = chart.data.datasets[0].data as number[];
    ctx.save();
    ctx.font =
      '600 11px Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
    ctx.fillStyle = colore;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    meta.data.forEach((barra, i) => {
      const { x, y } = barra.getProps(['x', 'y'], true) as {
        x: number;
        y: number;
      };
      ctx.fillText(NF.format(dati[i] ?? 0), x + 8, y);
    });
    ctx.restore();
  },
};

/**
 * Distribuzione settoriale del comune.
 *
 * Barre orizzontali ordinate, non una torta: sette fette sono troppe da
 * confrontare a occhio, mentre le barre ordinate si leggono in un colpo.
 * Un solo colore, perché il settore è già scritto sull'asse: la lunghezza
 * porta il dato, il colore non deve ricodificarlo.
 */
@Component({
  selector: 'app-sector-chart',
  standalone: true,
  template: `
    <div class="relative h-64 w-full">
      <canvas #canvas aria-label="Imprese per settore"></canvas>
    </div>
  `,
})
export class SectorChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  private readonly tema = inject(TemaService);

  @ViewChild('canvas', { static: true })
  canvas!: ElementRef<HTMLCanvasElement>;

  @Input({ required: true }) settori!: SettoriBreakdown;
  @Input() totale = 0;

  private chart?: Chart<'bar'>;

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
      type: 'bar',
      data: this.datiGrafico(),
      plugins: [etichette],
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { right: 46 } },
        plugins: {
          legend: { display: false },
          // @ts-expect-error opzioni del plugin locale
          etichetteFineBarra: { colore: this.tema.colore('ink-soft') },
          tooltip: {
            backgroundColor: this.tema.colore('shell'),
            borderColor: this.tema.colore('shell-3'),
            borderWidth: 1,
            padding: 10,
            titleColor: '#FFFFFF',
            bodyColor: this.tema.colore('ink-dim'),
            callbacks: {
              label: (item: TooltipItem<'bar'>) => {
                const valore = item.parsed.x as number;
                const pct = this.totale
                  ? ((valore / this.totale) * 100).toFixed(1)
                  : '0,0';
                return ` ${NF.format(valore)} imprese (${pct}%)`;
              },
            },
          },
        },
        scales: {
          x: {
            display: false,
            grid: { display: false },
            beginAtZero: true,
          },
          y: {
            grid: { display: false },
            border: { display: false },
            ticks: {
              font: { size: 11 },
              color: this.tema.colore('ink-soft'),
              crossAlign: 'far',
              autoSkip: false,
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

  private datiGrafico() {
    const righe = SETTORI.map((s: SettoreKey) => ({
      label: SETTORE_LABEL[s],
      valore: this.settori?.[s] ?? 0,
    })).sort((a, b) => b.valore - a.valore);

    return {
      labels: righe.map((r) => r.label),
      datasets: [
        {
          data: righe.map((r) => r.valore),
          backgroundColor: this.tema.colore('brand-2'),
          hoverBackgroundColor: this.tema.colore('brand'),
          borderRadius: 4,
          borderSkipped: false as const,
          barThickness: 14,
        },
      ],
    };
  }
}
