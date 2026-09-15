import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';

import { ComuneData, ComuneGeoProps } from '../../models/comune.model';
import {
  SETTORE_LABEL,
  SETTORI,
  SettoreKey,
} from '../../models/impresa.model';
import { DataService } from '../../services/data.service';
import {
  FILTRI_INIZIALI,
  FilterService,
  FilterState,
} from '../../services/filter.service';
import { MapService, PUGLIA_BOUNDS } from '../../services/map.service';
import { TemaService } from '../../services/tema.service';

/**
 * FEATURE 6 — Mappa delle opportunita settoriali.
 *
 * Per ogni comune calcola il "gap" rispetto alla media regionale nel settore
 * selezionato. Il confronto non e sui valori assoluti (penalizzerebbe sempre
 * i comuni piccoli) ma sulla QUOTA attesa: se in Puglia il settore vale in
 * media il 12% delle imprese di un comune, un comune con 1.000 imprese
 * dovrebbe averne circa 120; quante ne mancano e il gap.
 */
@Component({
  selector: 'app-opportunity-map',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './opportunity-map.component.html',
})
export class OpportunityMapComponent implements AfterViewInit, OnDestroy {
  private readonly data = inject(DataService);
  private readonly mapService = inject(MapService);
  private readonly filterService = inject(FilterService);
  private readonly tema = inject(TemaService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  readonly settori = SETTORI.filter((s) => s !== 'altro');
  readonly labels = SETTORE_LABEL;
  readonly settore = signal<SettoreKey>('turismo_ristorazione');
  readonly loading = this.data.loading;

  /** I cinque comuni con il gap piu alto nel settore selezionato. */
  readonly topOpportunita = signal<{ comune: ComuneData; gap: number }[]>([]);

  private mappa?: L.Map;
  private layer?: L.GeoJSON<ComuneGeoProps>;
  private legenda?: L.Control;
  private filtri: FilterState = { ...FILTRI_INIZIALI };
  private colori = new Map<string, string>();
  /**
   * Vero solo quando l'inquadratura e stata calcolata sui confini reali E con
   * il contenitore gia dimensionato: finche resta falso si riprova a ogni
   * ridisegno e a ogni cambio di dimensione.
   */
  private inquadrata = false;
  private osservatore?: ResizeObserver;

  constructor() {
    effect(() => {
      if (this.data.pronto() && this.mappa) this.disegna();
    });

    // Ridisegna al cambio tema: la rampa si inverte insieme allo sfondo.
    effect(() => {
      this.tema.tema();
      if (this.mappa && this.data.pronto()) this.disegna();
    });

    this.filterService.filtri$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) => {
        this.filtri = f;
        if (this.mappa) this.disegna();
      });
  }

  ngAfterViewInit(): void {
    this.mappa = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
      minZoom: 7,
      maxZoom: 14,
      zoomSnap: 0.25,
      wheelPxPerZoomLevel: 120,
    });
    this.mappa.fitBounds(PUGLIA_BOUNDS, { padding: [10, 10] });
    this.osservaDimensioni();
    if (this.data.pronto()) this.disegna();
  }

  ngOnDestroy(): void {
    this.osservatore?.disconnect();
    this.mappa?.remove();
  }

  /**
   * Stesso problema di MapComponent: Leaflet misura il contenitore solo alla
   * creazione. Se in quel momento il riquadro e ancora a zero — lazy loading
   * del chunk, CSS in differita, scheda in secondo piano — la mappa resta
   * vuota in silenzio. L'osservatore rimisura appena il riquadro esiste.
   */
  private osservaDimensioni(): void {
    this.osservatore = new ResizeObserver(() => {
      if (!this.mappa || !this.dimensionato) return;
      this.mappa.invalidateSize({ animate: false });
      this.inquadraSeServe();
    });
    this.osservatore.observe(this.mapContainer.nativeElement);
  }

  /** True se il riquadro della mappa occupa spazio sullo schermo. */
  private get dimensionato(): boolean {
    const el = this.mapContainer.nativeElement;
    return el.clientWidth > 0 && el.clientHeight > 0;
  }

  /** Reinquadra finche non c'e riuscita davvero: confini reali, riquadro reale. */
  private inquadraSeServe(): void {
    if (!this.mappa || this.inquadrata || !this.dimensionato) return;
    const bounds = this.layer?.getBounds();
    if (!bounds || !bounds.isValid()) return;
    this.mappa.fitBounds(bounds, { padding: [16, 16] });
    this.inquadrata = true;
  }

  cambiaSettore(valore: string): void {
    this.settore.set(valore as SettoreKey);
    this.disegna();
  }

  /** Imprese mancanti nel settore rispetto alla quota media regionale. */
  gap(c: ComuneData, settore: SettoreKey): number {
    const quotaMedia = this.data.statistiche().quotaMediaSettore[settore] ?? 0;
    const attese = quotaMedia * c.totale_imprese;
    return attese - (c.settori[settore] ?? 0);
  }

  /**
   * Gap in rapporto alle imprese attese (0-1).
   *
   * La mappa e colorata su questo, non sul gap assoluto: in valore assoluto
   * i capoluoghi dominerebbero sempre la scala e tutto il resto della regione
   * resterebbe nella classe piu chiara. La quota mancante e invece
   * confrontabile fra comuni di dimensioni diverse.
   */
  gapRelativo(c: ComuneData, settore: SettoreKey): number {
    const quotaMedia = this.data.statistiche().quotaMediaSettore[settore] ?? 0;
    const attese = quotaMedia * c.totale_imprese;
    if (attese <= 0) return 0;
    return Math.max(0, Math.min(1, this.gap(c, settore) / attese));
  }

  private disegna(): void {
    const geo = this.data.geo();
    if (!this.mappa || !geo) return;

    const settore = this.settore();
    const comuni = this.data.comuni();
    const inFiltro = comuni.filter((c) => FilterService.passa(c, this.filtri));
    const base = inFiltro.length > 1 ? inFiltro : comuni;

    // Scala sui soli gap positivi: dove il comune e gia sopra la media non
    // c'e opportunita da segnalare, quindi resta al colore piu chiaro.
    const relativi = base
      .map((c) => this.gapRelativo(c, settore))
      .filter((g) => g > 0);
    const maxRel = relativi.length ? Math.max(...relativi) : 1;

    const escluso = this.mapService.coloreEscluso();
    this.colori.clear();
    this.layer?.remove();

    this.layer = L.geoJSON<ComuneGeoProps>(geo as never, {
      style: (feature) => {
        const props = feature?.properties as ComuneGeoProps | undefined;
        const comune = props ? this.data.perCodice(props.istat) : undefined;
        if (!comune) return this.mapService.stile(escluso, true);

        if (!FilterService.passa(comune, this.filtri)) {
          this.colori.set(comune.istat, escluso);
          return this.mapService.stile(escluso, true);
        }

        const colore = this.mapService.getOpportunityColor(
          this.mapService.normalizza(
            this.gapRelativo(comune, settore),
            0,
            maxRel,
          ),
        );
        this.colori.set(comune.istat, colore);
        return this.mapService.stile(colore);
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as ComuneGeoProps;
        const comune = this.data.perCodice(props.istat);
        if (!comune) return;

        layer.bindTooltip(
          this.mapService.tooltipOpportunita(
            comune,
            settore,
            this.gap(comune, settore),
            this.gapRelativo(comune, settore),
          ),
          {
            sticky: true,
            direction: 'top',
            className: 'ip-tooltip',
            opacity: 1,
          },
        );

        layer.on({
          mouseover: (e) => {
            const path = e.target as L.Path;
            path.setStyle(
              this.mapService.stileHover(
                this.colori.get(comune.istat) ?? escluso,
              ),
            );
            path.bringToFront();
          },
          mouseout: (e) => {
            const path = e.target as L.Path;
            const colore = this.colori.get(comune.istat) ?? escluso;
            path.setStyle(this.mapService.stile(colore, colore === escluso));
          },
        });
      },
    }).addTo(this.mappa);

    this.inquadraSeServe();

    this.aggiornaLegenda(maxRel);

    this.topOpportunita.set(
      inFiltro
        .map((c) => ({ comune: c, gap: this.gap(c, settore) }))
        .filter((r) => r.gap > 0)
        .sort((a, b) => b.gap - a.gap)
        .slice(0, 5),
    );
  }

  private aggiornaLegenda(maxRel: number): void {
    if (!this.mappa) return;
    if (this.legenda) this.mappa.removeControl(this.legenda);

    this.legenda = this.mapService.creaLegenda(
      `Quota mancante — ${SETTORE_LABEL[this.settore()]}`,
      this.mapService.etichetteScala(0, maxRel * 100, '%'),
      this.mapService.scalaOpportunita(),
      'Imprese mancanti sul totale atteso',
      `0,0 – ${(maxRel * 100).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    );
    this.legenda.addTo(this.mappa);
  }
}
