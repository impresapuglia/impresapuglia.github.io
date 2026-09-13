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
  readonly pronto = this.data.pronto;
}
