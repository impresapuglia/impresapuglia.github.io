import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { DataService } from '../../services/data.service';
import { LogoComponent } from '../logo/logo.component';

/**
 * Pagina di ingresso: marchio, titolo e le due porte d'accesso —
 * la mappa e la guida alla lettura.
 *
 * I tre numeri in fondo arrivano dal dataset già caricato dalla shell, così
 * chi arriva capisce subito la scala di quello che sta per esplorare.
 */
@Component({
  selector: 'app-welcome',
  standalone: true,
  imports: [CommonModule, RouterLink, LogoComponent],
  templateUrl: './welcome.component.html',
})
export class WelcomeComponent {
  private readonly data = inject(DataService);

  readonly statistiche = this.data.statistiche;
  readonly meta = this.data.meta;
  readonly pronto = this.data.pronto;

  constructor() {
    // La nota sui dati cita gli anni reali del dataset: chi arriva da un link
    // diretto alla home non passa dalla mappa, quindi il caricamento va avviato
    // anche qui (è idempotente).
    this.data.load();
  }
}
