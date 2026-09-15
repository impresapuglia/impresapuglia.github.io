import { Injectable, inject } from '@angular/core';

import {
  ComuneData,
  quotaSettore,
  settoreDominante,
  variazioneAnnua,
  variazionePeriodo,
} from '../models/comune.model';
import { SETTORE_LABEL, SETTORI, SettoreKey } from '../models/impresa.model';
import { DataService } from './data.service';

const NF = new Intl.NumberFormat('it-IT');
const NF1 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

/**
 * True se il numero, letto in italiano, inizia per vocale: 1 "uno", 8 "otto",
 * 11 "undici", 18 "diciotto", 80-89 "ottanta...". Da 100 in su si legge
 * "cento..." e quindi torna consonante.
 */
function iniziaPerVocale(n: number): boolean {
  const i = Math.floor(Math.abs(n));
  if (i >= 100) return false;
  if (i >= 80 && i <= 89) return true;
  if (i >= 20) return false;
  return i === 1 || i === 8 || i === 11 || i === 18;
}

/**
 * Articolo determinativo davanti a una percentuale: "l'1,6%", "lo 0,8%",
 * "il 2,3%". Concatenare sempre "il" produrrebbe "il 8,2%", che e sbagliato:
 * l'articolo segue la pronuncia, non la cifra.
 */
function articolo(n: number): string {
  if (Math.floor(Math.abs(n)) === 0) return 'lo';
  return iniziaPerVocale(n) ? "l'" : 'il';
}

/** Come articolo(), ma preposizione articolata: del / dello / dell'. */
function del(n: number): string {
  if (Math.floor(Math.abs(n)) === 0) return 'dello';
  return iniziaPerVocale(n) ? "dell'" : 'del';
}

/** Unisce articolo e numero: l'elisione non vuole lo spazio, gli altri si. */
function conArticolo(articoloScelto: string, testo: string): string {
  return articoloScelto.endsWith("'")
    ? `${articoloScelto}${testo}`
    : `${articoloScelto} ${testo}`;
}

/**
 * Sintesi testuale di un comune, calcolata in locale sui dati gia caricati.
 *
 * Nessuna chiamata di rete e nessuna chiave: e solo confronto fra i valori del
 * comune e le medie regionali, con le frasi scelte in base a quali soglie
 * vengono superate. Costo zero e risultato deterministico: lo stesso comune
 * produce sempre lo stesso testo.
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
    const settore = SETTORE_LABEL[dominante].toLowerCase();

    if (c.densita_imprenditoriale >= stat.densitaMedia && stat.densitaMedia) {
      const scarto =
        ((c.densita_imprenditoriale - stat.densitaMedia) / stat.densitaMedia) *
        100;
      return `${c.comune} ha ${NF1.format(c.densita_imprenditoriale)} imprese attive ogni 1.000 abitanti, ${NF1.format(scarto)}% sopra la media regionale, con il ${settore} come settore più presidiato.`;
    }

    if (c.dimensione_media >= stat.dimensioneMedia && stat.dimensioneMedia) {
      return `${c.comune} ha poche imprese ma più strutturate della media: ${NF1.format(c.dimensione_media)} addetti per impresa contro ${NF1.format(stat.dimensioneMedia)} in Puglia, soprattutto nel ${settore}.`;
    }

    const quota = quotaSettore(c, dominante);
    return `Il tessuto produttivo di ${c.comune} conta ${NF.format(c.totale_imprese)} imprese attive ed è specializzato nel ${settore}, che da solo vale ${conArticolo(articolo(quota), NF1.format(quota))}% del totale.`;
  }

  private criticita(c: ComuneData): string {
    const stat = this.data.statistiche();
    const annua = variazioneAnnua(c);
    const periodo = variazionePeriodo(c);

    if (annua < 0) {
      const calo = Math.abs(annua);
      const segno = periodo >= 0 ? '+' : '−';
      return `Nell'ultimo anno le imprese attive sono calate ${conArticolo(del(calo), NF1.format(calo))}%, e sull'intero periodo il saldo è ${segno}${NF1.format(Math.abs(periodo))}%.`;
    }
    if (c.saldo_demografico < 0) {
      return `Il saldo fra iscrizioni e cessazioni è negativo (${NF1.format(c.saldo_demografico)} ogni 100 imprese registrate): si apre meno di quanto si chiude.`;
    }
    if (c.tasso_natalita < stat.natalitaMedia) {
      return `Il ricambio è lento: ${NF1.format(c.tasso_natalita)} nuove iscrizioni ogni 100 imprese, sotto la media regionale di ${NF1.format(stat.natalitaMedia)}.`;
    }
    if (c.dimensione_media < stat.dimensioneMedia) {
      return `Le imprese restano piccole: ${NF1.format(c.dimensione_media)} addetti in media contro ${NF1.format(stat.dimensioneMedia)} in Puglia.`;
    }
    return `La crescita dell'ultimo anno è stata ${conArticolo(del(annua), NF1.format(annua))}%, un ritmo che non compensa la concentrazione su pochi settori.`;
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
