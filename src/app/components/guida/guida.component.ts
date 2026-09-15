import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { METRICHE, SETTORE_COMPOSIZIONE, SETTORI, SETTORE_LABEL } from '../../models/impresa.model';
import { DataService } from '../../services/data.service';
import { MapService } from '../../services/map.service';

/** Voce dell'indice laterale. */
interface Sezione {
  id: string;
  titolo: string;
}

/**
 * Dataset di origine mostrato nella tabella delle fonti.
 *
 * `stato` dice cosa ne fa l'app adesso, non cosa potrebbe farne:
 *   collegato  — i suoi numeri sono quelli che vedi nell'app;
 *   scartato   — scaricato dalla pipeline e messo da parte, con il motivo;
 *   valutato   — esaminato e non usato, con il motivo.
 */
interface Fonte {
  titolo: string;
  ente: string;
  copertura: string;
  usoNellApp: string;
  url: string;
  stato: 'collegato' | 'scartato' | 'valutato';
}

const STATO_LABEL: Record<Fonte['stato'], string> = {
  collegato: 'collegato',
  scartato: 'scartato',
  valutato: 'non usato',
};

/**
 * Guida alla lettura: cosa fa l'app, come muoversi, come si interpretano
 * mappa e grafici, e da quali dataset arrivano i numeri.
 */
@Component({
  selector: 'app-guida',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './guida.component.html',
})
export class GuidaComponent {
  private readonly mapService = inject(MapService);
  private readonly data = inject(DataService);

  /** Le rampe mostrate sono quelle del tema attivo, non una copia fissa. */
  readonly scalaDensita = computed(() => this.mapService.scalaDensita());
  readonly scalaOpportunita = computed(() => this.mapService.scalaOpportunita());

  /** Anni di riferimento, letti dal dataset invece che scritti a mano. */
  readonly meta = this.data.meta;
  readonly statistiche = this.data.statistiche;

  readonly metriche = METRICHE;
  readonly settori = SETTORI;
  readonly settoreLabel = SETTORE_LABEL;
  readonly composizione = SETTORE_COMPOSIZIONE;
  readonly statoLabel = STATO_LABEL;

  /** Estremi della serie storica, per le etichette ("2020–2024"). */
  readonly periodoSerie = computed(() => {
    const anni = this.meta().anni_trend;
    return anni.length ? `${anni[0]}–${anni[anni.length - 1]}` : '';
  });

  constructor() {
    // La guida mostra anni e totali reali: senza i dati caricati mostrerebbe
    // zeri, e chi arriva da un link diretto alla guida non passa dalla mappa.
    this.data.load();
  }

  readonly sezioni: Sezione[] = [
    { id: 'cos-e', titolo: "Cos'è ImpresaPuglia" },
    { id: 'muoversi', titolo: 'Come muoversi' },
    { id: 'mappa', titolo: 'Come leggere la mappa' },
    { id: 'metriche', titolo: 'Le tre metriche' },
    { id: 'settori', titolo: 'I sette settori' },
    { id: 'filtri', titolo: 'I filtri' },
    { id: 'comune', titolo: 'Il pannello del comune' },
    { id: 'opportunita', titolo: 'La mappa delle opportunità' },
    { id: 'dati', titolo: 'Da dove vengono i dati' },
    { id: 'limiti', titolo: 'Limiti da conoscere' },
  ];

  readonly fonti: Fonte[] = [
    {
      titolo: 'Confini amministrativi dei comuni',
      ente: 'ISTAT, tramite openpolis/geojson-italy',
      copertura: '257 comuni pugliesi',
      usoNellApp:
        'La geometria di ogni comune sulla mappa e il codice ISTAT che lega i confini ai dati.',
      url: 'https://github.com/openpolis/geojson-italy',
      stato: 'collegato',
    },
    {
      titolo: 'Imprese attive e addetti in Puglia a livello comunale',
      ente: 'IPRES per la Regione Puglia · Open Data (CKAN)',
      copertura: '257 comuni × 5 anni (2020–2024) × 21 sezioni ATECO',
      usoNellApp:
        'È la fonte principale: imprese attive, addetti, dimensione media, distribuzione settoriale e tutta la serie storica del grafico.',
      url: 'https://dati.puglia.it/ckan/dataset/imprese-attive-e-addetti-in-puglia-a-livello-comunale-anni-2020-e-20211',
      stato: 'collegato',
    },
    {
      titolo: 'Nati-mortalità delle imprese pugliesi',
      ente: 'IPRES per la Regione Puglia · Open Data (CKAN)',
      copertura: '257 comuni, anni 2019, 2022 e 2023',
      usoNellApp:
        'Imprese registrate, iscrizioni e cessazioni: da qui vengono il tasso di natalità e il saldo demografico.',
      url: 'https://dati.puglia.it/ckan/dataset/nati-mortalita-delle-imprese-pugliesi',
      stato: 'collegato',
    },
    {
      titolo: 'Popolazione residente per comune',
      ente: 'ISTAT · Censimento permanente 2021',
      copertura: '257 comuni pugliesi, 3.926.931 abitanti',
      usoNellApp:
        'Denominatore della densità imprenditoriale. Il portale regionale non pubblica la popolazione comunale, quindi la pipeline la prende dal censimento ISTAT e la unisce per codice ISTAT.',
      url: 'https://www.istat.it/statistiche-per-temi/censimenti/popolazione-e-abitazioni/',
      stato: 'collegato',
    },
    {
      titolo: 'Imprese per comune e settore di attività economica',
      ente: 'Regione Puglia · Open Data (CKAN)',
      copertura: 'Solo anno 2011',
      usoNellApp:
        'Scartato: il dataset contiene un unico anno, il 2011. Usarlo come fotografia corrente vorrebbe dire pubblicare numeri di quindici anni fa.',
      url: 'https://dati.puglia.it/ckan/dataset/imprese-per-comune-e-settore-di-attivita-economica',
      stato: 'scartato',
    },
    {
      titolo: 'Unità locali delle imprese per comune e settore',
      ente: 'Regione Puglia · Open Data (CKAN)',
      copertura: 'Solo anno 2011',
      usoNellApp:
        'Scartato per lo stesso motivo. Sarebbe una buona controprova — le unità locali contano le sedi operative, non le imprese registrate — ma non è aggiornato.',
      url: 'https://dati.puglia.it/ckan/dataset/unita-locali-delle-imprese-per-comune-e-settore-di-attivita-economica',
      stato: 'scartato',
    },
    {
      titolo: 'Serie trimestrali della Camera di Commercio di Lecce',
      ente: 'CCIAA Lecce · Open Data Regione Puglia',
      copertura: 'Provincia di Lecce, trimestri 2016–2020',
      usoNellApp:
        'Non usato: sono le uniche serie comunali con il dettaglio su imprese femminili e giovanili, ma coprono una provincia su sei e si fermano al 2020. Una mappa colorata su questi dati resterebbe vuota su 161 comuni.',
      url: 'https://dati.puglia.it/ckan/group/economia-e-finanze',
      stato: 'valutato',
    },
  ];

  /** Fonti che alimentano davvero l'app. */
  readonly fontiCollegate = computed(() =>
    this.fonti.filter((f) => f.stato === 'collegato'),
  );
}
