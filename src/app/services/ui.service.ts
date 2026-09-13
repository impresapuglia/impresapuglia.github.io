import { Injectable, signal } from '@angular/core';

import { ComuneData } from '../models/comune.model';

/**
 * Stato di interfaccia condiviso fra la shell (AppComponent) e le pagine
 * caricate dal router: comune selezionato e apertura del pannello assistente.
 */
@Injectable({ providedIn: 'root' })
export class UiService {
  /** Comune attualmente aperto nel pannello di destra. */
  readonly comuneSelezionato = signal<ComuneData | null>(null);
  /** Il pannello dell'assistente e visibile. */
  readonly chatAperta = signal(false);

  seleziona(comune: ComuneData | null): void {
    this.comuneSelezionato.set(comune);
  }

  chiudiPannello(): void {
    this.comuneSelezionato.set(null);
  }

  chiudiChat(): void {
    this.chatAperta.set(false);
  }

  toggleChat(): void {
    this.chatAperta.update((v) => !v);
  }
}
