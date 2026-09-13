import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { MapService } from '../../services/map.service';

/** Voce dell'indice laterale. */
interface Sezione {
  id: string;
  titolo: string;
}

/** Dataset di origine mostrato nella tabella delle fonti. */
interface Fonte {
  titolo: string;
  ente: string;
  copertura: string;
  usoNellApp: string;
  url: string;
  stato: 'collegato' | 'previsto';
}

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

  /** Le rampe mostrate sono quelle del tema attivo, non una copia fissa. */
  readonly scalaDensita = computed(() => this.mapService.scalaDensita());
  readonly scalaOpportunita = computed(() => this.mapService.scalaOpportunita());

  readonly sezioni: Sezione[] = [
    { id: 'cos-e', titolo: "Cos'è ImpresaPuglia" },
    { id: 'muoversi', titolo: 'Come muoversi' },
    { id: 'mappa', titolo: 'Come leggere la mappa' },
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
      usoNellApp: 'La geometria di ogni comune sulla mappa e il codice ISTAT che lega i confini ai dati.',
      url: 'https://github.com/openpolis/geojson-italy',
      stato: 'collegato',
    },
    {
      titolo: 'Imprese per comune e settore di attività economica',
      ente: 'Regione Puglia · Open Data (CKAN)',
      copertura: 'Serie annuale, livello comunale',
      usoNellApp: 'Totale imprese e distribuzione nei sette settori. Colonne: Anno, Territorio, Ateco 2007, Numero imprese.',
      url: 'https://dati.puglia.it/ckan/dataset/imprese-per-comune-e-settore-di-attivita-economica',
      stato: 'previsto',
    },
    {
      titolo: 'Unità locali delle imprese per comune e settore',
      ente: 'Regione Puglia · Open Data (CKAN)',
      copertura: 'Serie annuale, livello comunale',
      usoNellApp: 'Controprova sulla presenza produttiva: le unità locali contano le sedi operative, non le imprese registrate.',
      url: 'https://dati.puglia.it/ckan/dataset/unita-locali-delle-imprese-per-comune-e-settore-di-attivita-economica',
      stato: 'previsto',
    },
    {
      titolo: 'Imprese attive e addetti a livello comunale',
      ente: 'Regione Puglia · Open Data (CKAN)',
      copertura: 'Dal 2020',
      usoNellApp: 'Distinzione fra imprese registrate e imprese effettivamente attive, più il numero di addetti.',
      url: 'https://dati.puglia.it/ckan/dataset/imprese-attive-e-addetti-in-puglia-a-livello-comunale-anni-2020-e-20211',
      stato: 'previsto',
    },
    {
      titolo: 'Imprese femminili dei comuni della provincia di Lecce',
      ente: 'Camera di Commercio di Lecce · Open Data Regione Puglia',
      copertura: 'Serie trimestrali, provincia di Lecce',
      usoNellApp: 'Quota di imprese femminili per comune e serie storica trimestrale.',
      url: 'https://dati.puglia.it/ckan/group/economia-e-finanze',
      stato: 'previsto',
    },
    {
      titolo: 'Imprese giovanili dei comuni della provincia di Lecce',
      ente: 'Camera di Commercio di Lecce · Open Data Regione Puglia',
      copertura: 'Serie trimestrali, provincia di Lecce',
      usoNellApp: 'Quota di imprese guidate da under 35 per comune.',
      url: 'https://dati.puglia.it/ckan/group/economia-e-finanze',
      stato: 'previsto',
    },
    {
      titolo: 'Nati-mortalità delle imprese pugliesi',
      ente: 'Regione Puglia · Open Data (CKAN)',
      copertura: 'Serie storica regionale e provinciale',
      usoNellApp: 'Iscrizioni e cessazioni: la base per il trend trimestrale.',
      url: 'https://dati.puglia.it/ckan/dataset/nati-mortalita-delle-imprese-pugliesi',
      stato: 'previsto',
    },
    {
      titolo: 'Popolazione residente comunale',
      ente: 'ISTAT',
      copertura: 'Annuale, livello comunale',
      usoNellApp: 'Denominatore della densità imprenditoriale (imprese ogni 1.000 abitanti). Senza questo dato la densità non è calcolabile.',
      url: 'https://demo.istat.it/',
      stato: 'previsto',
    },
  ];
}
