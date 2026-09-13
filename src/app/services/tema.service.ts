import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

export type Tema = 'chiaro' | 'scuro';

const CHIAVE = 'impresapuglia:tema';

/**
 * Tema dell'interfaccia.
 *
 * Scrive `data-theme` sull'elemento radice: da lì in giù tutto il colore
 * arriva dalle variabili CSS definite in styles.scss, quindi cambiare tema
 * non richiede classi alternative nei template.
 *
 * All'avvio vince la scelta salvata dall'utente; se non c'è, si segue la
 * preferenza di sistema.
 */
@Injectable({ providedIn: 'root' })
export class TemaService {
  private readonly documento = inject(DOCUMENT);

  readonly tema = signal<Tema>(this.temaIniziale());

  constructor() {
    effect(() => {
      const t = this.tema();
      this.documento.documentElement.setAttribute('data-theme', t);
      try {
        this.documento.defaultView?.localStorage.setItem(CHIAVE, t);
      } catch {
        // Modalità privata o storage disabilitato: il tema vale per la sessione.
      }
    });
  }

  alterna(): void {
    this.tema.update((t) => (t === 'scuro' ? 'chiaro' : 'scuro'));
  }

  imposta(t: Tema): void {
    this.tema.set(t);
  }

  /**
   * Valore corrente di una variabile di colore, come stringa CSS.
   * Serve a Chart.js, che vuole colori concreti e non sa leggere i token.
   */
  colore(nome: string, alpha = 1): string {
    const vista = this.documento.defaultView;
    if (!vista) return '#000000';
    const triplet = vista
      .getComputedStyle(this.documento.documentElement)
      .getPropertyValue(`--c-${nome}`)
      .trim();
    if (!triplet) return '#000000';
    return alpha === 1
      ? `rgb(${triplet})`
      : `rgb(${triplet} / ${alpha})`;
  }

  private temaIniziale(): Tema {
    try {
      const salvato = this.documento.defaultView?.localStorage.getItem(CHIAVE);
      if (salvato === 'chiaro' || salvato === 'scuro') return salvato;
    } catch {
      // ignorata: si ricade sulla preferenza di sistema
    }
    const scuroDiSistema =
      this.documento.defaultView?.matchMedia?.('(prefers-color-scheme: dark)')
        .matches ?? false;
    return scuroDiSistema ? 'scuro' : 'chiaro';
  }
}
