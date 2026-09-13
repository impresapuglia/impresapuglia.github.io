import { Injectable, inject } from '@angular/core';
import * as L from 'leaflet';

import { ComuneData, pctFemminili, pctGiovanili } from '../models/comune.model';
import {
  MetricaMappa,
  SETTORE_LABEL,
  SettoreKey,
} from '../models/impresa.model';
import { TemaService } from './tema.service';

/** Riquadro che contiene tutta la Puglia, usato come ripiego per il fit. */
export const PUGLIA_BOUNDS = L.latLngBounds(
  L.latLng(39.75, 14.9),
  L.latLng(42.25, 18.65),
);

/** Sei soglie della scala choropleth, su valore normalizzato 0-100. */
export const SOGLIE_CHOROPLETH = [0, 20, 40, 60, 75, 90] as const;

/**
 * Scale di densità, una per tema.
 *
 * La direzione della luce si inverte con lo sfondo: su tela scura il valore
 * alto è quello che accende il comune, su tela chiara è quello che lo scurisce.
 * Tenere la stessa rampa in entrambi i temi farebbe sparire metà dei comuni
 * nel fondo. Passi a luminosità OKLCH equispaziata, validati per monotonia,
 * distanza fra i passi e contrasto della classe più bassa contro la tela.
 */
export const SCALA_DENSITA_SCURO = [
  '#00653e',
  '#008052',
  '#079c69',
  '#3db783',
  '#69d19f',
  '#95e9bf',
] as const;

export const SCALA_DENSITA_CHIARO = [
  '#61b98f',
  '#2ba171',
  '#008755',
  '#006d3c',
  '#005226',
  '#003814',
] as const;

/** Scale opportunità: oro, stessa costruzione. */
export const SCALA_OPPORTUNITA_SCURO = [
  '#694e00',
  '#856600',
  '#a17f02',
  '#bc9a35',
  '#d5b55f',
  '#ecd28b',
] as const;

export const SCALA_OPPORTUNITA_CHIARO = [
  '#bda258',
  '#a68624',
  '#8d6b00',
  '#735100',
  '#583900',
  '#3d2300',
] as const;

/** Colore dei comuni esclusi dai filtri correnti, per tema. */
const ESCLUSO = { scuro: '#14301F', chiaro: '#C2D6C8' } as const;

const NF = new Intl.NumberFormat('it-IT');
const NF1 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Logica di presentazione della mappa Leaflet: scale colore, stili delle
 * feature, tooltip e legenda. Non tiene stato: i componenti mappa possono
 * usarlo in parallelo.
 */
@Injectable({ providedIn: 'root' })
export class MapService {
  private readonly tema = inject(TemaService);

  // -----------------------------------------------------------------
  // Scala colori
  // -----------------------------------------------------------------

  /** Rampa densità del tema corrente. */
  scalaDensita(): readonly string[] {
    return this.tema.tema() === 'scuro'
      ? SCALA_DENSITA_SCURO
      : SCALA_DENSITA_CHIARO;
  }

  /** Rampa opportunità del tema corrente. */
  scalaOpportunita(): readonly string[] {
    return this.tema.tema() === 'scuro'
      ? SCALA_OPPORTUNITA_SCURO
      : SCALA_OPPORTUNITA_CHIARO;
  }

  /** Colore dei comuni fuori dai filtri, nel tema corrente. */
  coloreEscluso(): string {
    return ESCLUSO[this.tema.tema()];
  }

  /** Colore della tela, usato anche come bordo fra i comuni. */
  canvas(): string {
    return this.tema.colore('canvas');
  }

  /**
   * Colore choropleth per un valore già normalizzato nell'intervallo 0-100.
   * Sei soglie: 0, 20, 40, 60, 75, 90.
   */
  getColor(value: number): string {
    return this.classe(value, this.scalaDensita());
  }

  /** Come getColor, ma sulla scala oro della mappa opportunità. */
  getOpportunityColor(value: number): string {
    return this.classe(value, this.scalaOpportunita());
  }

  private classe(value: number, scala: readonly string[]): string {
    const v = Number.isFinite(value) ? value : 0;
    if (v >= SOGLIE_CHOROPLETH[5]) return scala[5];
    if (v >= SOGLIE_CHOROPLETH[4]) return scala[4];
    if (v >= SOGLIE_CHOROPLETH[3]) return scala[3];
    if (v >= SOGLIE_CHOROPLETH[2]) return scala[2];
    if (v >= SOGLIE_CHOROPLETH[1]) return scala[1];
    return scala[0];
  }

  /** Valore grezzo del comune per la metrica selezionata. */
  valoreMetrica(c: ComuneData, metrica: MetricaMappa): number {
    switch (metrica) {
      case 'femminili':
        return pctFemminili(c);
      case 'giovanili':
        return pctGiovanili(c);
      default:
        return c.densita_imprenditoriale;
    }
  }

  /** Porta un valore nell'intervallo 0-100 rispetto al min/max del dataset. */
  normalizza(valore: number, min: number, max: number): number {
    if (!Number.isFinite(valore)) return 0;
    if (max <= min) return 50;
    return Math.max(0, Math.min(100, ((valore - min) / (max - min)) * 100));
  }

  /**
   * Valori della metrica, ordinati: base per le classi a quantili.
   *
   * La densità imprenditoriale si distribuisce attorno alla media, quindi le
   * classi a intervallo costante finirebbero quasi tutte nelle due fascie
   * centrali e la mappa uscirebbe monocroma. Classificando sul rango
   * percentuale ogni classe riceve una fetta simile di comuni e le differenze
   * territoriali tornano visibili.
   */
  ordinati(comuni: ComuneData[], metrica: MetricaMappa): number[] {
    return comuni.map((c) => this.valoreMetrica(c, metrica)).sort((a, b) => a - b);
  }

  /** Posizione percentuale (0-100) di un valore nella distribuzione. */
  rango(valore: number, ordinati: number[]): number {
    const n = ordinati.length;
    if (n === 0) return 0;
    let lo = 0;
    let hi = n;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (ordinati[mid] < valore) lo = mid + 1;
      else hi = mid;
    }
    return (lo / n) * 100;
  }

  /** Valore in corrispondenza di un percentile (0-100). */
  percentile(ordinati: number[], p: number): number {
    if (ordinati.length === 0) return 0;
    const i = Math.min(
      ordinati.length - 1,
      Math.max(0, Math.round((p / 100) * (ordinati.length - 1))),
    );
    return ordinati[i];
  }

  /** Etichette delle sei classi a quantili, con i valori reali dei confini. */
  etichetteQuantili(ordinati: number[], suffisso = ''): string[] {
    const valori = SOGLIE_CHOROPLETH.map((s) => this.percentile(ordinati, s));
    return valori.map((v, i) => {
      const succ = valori[i + 1];
      return succ === undefined
        ? `oltre ${NF1.format(v)}${suffisso}`
        : `${NF1.format(v)} – ${NF1.format(succ)}${suffisso}`;
    });
  }

  /** Min e max della metrica sull'insieme di comuni passato. */
  estremi(comuni: ComuneData[], metrica: MetricaMappa): [number, number] {
    if (comuni.length === 0) return [0, 1];
    let min = Number.POSITIVE_INFINITY;
    let max = Number.NEGATIVE_INFINITY;
    for (const c of comuni) {
      const v = this.valoreMetrica(c, metrica);
      if (v < min) min = v;
      if (v > max) max = v;
    }
    return [min, max];
  }

  // -----------------------------------------------------------------
  // Stili
  // -----------------------------------------------------------------

  /**
   * Stile di riempimento di un comune. Il bordo è del colore della tela:
   * fa da stacco fra celle adiacenti senza aggiungere una linea visibile.
   */
  stile(colore: string, attenuato = false): L.PathOptions {
    return {
      fillColor: colore,
      fillOpacity: attenuato ? 0.5 : 1,
      color: this.canvas(),
      weight: 0.8,
      opacity: 1,
    };
  }

  /** Stile applicato al passaggio del mouse. */
  stileHover(colore: string): L.PathOptions {
    return {
      fillColor: colore,
      fillOpacity: 1,
      color: this.tema.colore('ink'),
      weight: 1.6,
      opacity: 1,
    };
  }

  /** Stile del comune attualmente selezionato. */
  stileSelezionato(colore: string): L.PathOptions {
    return {
      fillColor: colore,
      fillOpacity: 1,
      color: this.tema.colore('gold-2'),
      weight: 2.4,
      opacity: 1,
    };
  }

  // -----------------------------------------------------------------
  // Tooltip
  // -----------------------------------------------------------------

  /** Tooltip della mappa principale: nome, totale imprese, % femminili. */
  tooltipComune(c: ComuneData): string {
    return `
      <span class="ip-tooltip__title">${this.escape(c.comune)} <span class="ip-tooltip__prov">${c.provincia}</span></span>
      <span class="ip-tooltip__row">Imprese <span class="ip-tooltip__value">${NF.format(c.totale_imprese)}</span></span>
      <span class="ip-tooltip__row">Femminili <span class="ip-tooltip__value">${NF1.format(pctFemminili(c))}%</span></span>
      <span class="ip-tooltip__row">Densità <span class="ip-tooltip__value">${NF1.format(c.densita_imprenditoriale)}</span> / 1.000 ab.</span>
    `;
  }

  /**
   * Tooltip della mappa opportunità.
   * @param gap imprese mancanti rispetto alla quota media regionale
   * @param quota gap in rapporto alle imprese attese (0-1)
   */
  tooltipOpportunita(
    c: ComuneData,
    settore: SettoreKey,
    gap: number,
    quota: number,
  ): string {
    const label = this.escape(SETTORE_LABEL[settore].toLowerCase());
    const corpo =
      gap > 0
        ? `Mancano <span class="ip-tooltip__value">${NF.format(Math.round(gap))}</span> imprese nel ${label} rispetto alla media regionale (${NF1.format(quota * 100)}% di quelle attese)`
        : `Sopra la media regionale nel ${label}: <span class="ip-tooltip__value">+${NF.format(Math.round(-gap))}</span> imprese`;

    return `
      <span class="ip-tooltip__title">${this.escape(c.comune)} <span class="ip-tooltip__prov">${c.provincia}</span></span>
      <span class="ip-tooltip__row ip-tooltip__wrap">${corpo}</span>
      <span class="ip-tooltip__row">Attuali <span class="ip-tooltip__value">${NF.format(c.settori[settore] ?? 0)}</span> su ${NF.format(Math.round((c.settori[settore] ?? 0) + Math.max(0, gap)))} attese</span>
    `;
  }

  // -----------------------------------------------------------------
  // Legenda
  // -----------------------------------------------------------------

  /**
   * Crea il controllo legenda in basso a destra.
   * `etichette` deve contenere sei voci, una per classe della scala.
   */
  creaLegenda(
    titolo: string,
    etichette: string[],
    scala: readonly string[],
    nota?: string,
  ): L.Control {
    const control = new L.Control({ position: 'bottomright' });
    control.onAdd = () => {
      const div = L.DomUtil.create('div', 'ip-legend');
      const righe = scala
        .map(
          (colore, i) =>
            `<div class="ip-legend__row"><span class="ip-legend__swatch" style="background:${colore}"></span><span>${this.escape(etichette[i] ?? '')}</span></div>`,
        )
        .reverse()
        .join('');
      div.innerHTML =
        `<div class="ip-legend__title">${this.escape(titolo)}</div>${righe}` +
        (nota ? `<div class="ip-legend__note">${this.escape(nota)}</div>` : '');
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    return control;
  }

  /** Etichette delle sei classi a partire dal min/max reale della metrica. */
  etichetteScala(min: number, max: number, suffisso = ''): string[] {
    const valori = SOGLIE_CHOROPLETH.map(
      (soglia) => min + ((max - min) * soglia) / 100,
    );
    return valori.map((v, i) => {
      const successivo = valori[i + 1];
      const a = NF1.format(v);
      return successivo === undefined
        ? `oltre ${a}${suffisso}`
        : `${a} – ${NF1.format(successivo)}${suffisso}`;
    });
  }

  private escape(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
