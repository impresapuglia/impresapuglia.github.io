import { Injectable, inject } from '@angular/core';

import {
  ComuneData,
  pctFemminili,
  pctGiovanili,
  settoreDominante,
  trendAnnuo,
} from '../models/comune.model';
import { SETTORE_LABEL, SETTORI, SettoreKey } from '../models/impresa.model';
import { DataService } from './data.service';

const NF = new Intl.NumberFormat('it-IT');
const NF1 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * Sintesi testuale di un comune, calcolata in locale sui dati gia caricati.
 *
 * Nessuna chiamata di rete e nessuna chiave: e solo confronto fra i valori
 * del comune e le medie regionali, con le frasi scelte in base a quali
 * soglie vengono superate. Costo zero e risultato deterministico.
 */
@Injectable({ providedIn: 'root' })
export class SintesiService {
  private readonly data = inject(DataService);

  /** Tre frasi: punto di forza, criticita, opportunita. */
  perComune(c: ComuneData): string {
    return [this.forza(c), this.criticita(c), this.opportunita(c)].join(' ');
  }

  // -----------------------------------------------------------------

  private forza(c: ComuneData): string {
    const stat = this.data.statistiche();
    const dominante = settoreDominante(c);
    const quota = c.totale_imprese
      ? ((c.settori[dominante] ?? 0) / c.totale_imprese) * 100
      : 0;

    if (c.densita_imprenditoriale >= stat.densitaMedia) {
      const scarto =
        ((c.densita_imprenditoriale - stat.densitaMedia) / stat.densitaMedia) *
        100;
      return `${c.comune} ha ${NF1.format(c.densita_imprenditoriale)} imprese ogni 1.000 abitanti, ${NF1.format(scarto)}% sopra la media regionale, con il ${SETTORE_LABEL[dominante].toLowerCase()} come settore più presidiato.`;
    }

    return `Il tessuto produttivo di ${c.comune} conta ${NF.format(c.totale_imprese)} imprese ed è specializzato nel ${SETTORE_LABEL[dominante].toLowerCase()}, che da solo vale il ${NF1.format(quota)}% del totale.`;
  }

  private criticita(c: ComuneData): string {
    const stat = this.data.statistiche();
    const mediaF = stat.totaleImprese
      ? (stat.totaleFemminili / stat.totaleImprese) * 100
      : 0;
    const pctF = pctFemminili(c);
    const trend = trendAnnuo(c);

    if (pctF < mediaF - 1) {
      return `La quota di imprese femminili si ferma al ${NF1.format(pctF)}%, sotto la media regionale del ${NF1.format(mediaF)}%.`;
    }
    if (trend < 0) {
      return `Nell'ultimo anno le imprese registrate sono calate del ${NF1.format(Math.abs(trend))}%.`;
    }
    if (pctGiovanili(c) < 8) {
      return `Il ricambio generazionale è lento: solo il ${NF1.format(pctGiovanili(c))}% delle imprese è guidato da under 35.`;
    }
    return `La crescita dell'ultimo anno è stata del ${NF1.format(trend)}%, un ritmo che non compensa la concentrazione su pochi settori.`;
  }

  private opportunita(c: ComuneData): string {
    const mancanti = this.settoriSottoMedia(c);
    if (mancanti.length === 0) {
      return 'Su tutti i settori il comune è allineato o sopra la quota media regionale: i margini di ingresso sono limitati.';
    }
    const elenco = mancanti
      .slice(0, 2)
      .map((s) => SETTORE_LABEL[s].toLowerCase())
      .join(' e ');
    return `I margini più ampi per chi vuole avviare un'attività sono in ${elenco}, dove il comune resta sotto la quota media regionale.`;
  }

  /** Settori in cui il comune ha meno imprese di quante ne siano attese. */
  private settoriSottoMedia(c: ComuneData): SettoreKey[] {
    const quote = this.data.statistiche().quotaMediaSettore;
    return SETTORI.filter((s) => s !== 'altro')
      .map((s) => ({
        settore: s,
        gap: quote[s] * c.totale_imprese - (c.settori[s] ?? 0),
      }))
      .filter((r) => r.gap > 0)
      .sort((a, b) => b.gap - a.gap)
      .map((r) => r.settore);
  }
}
