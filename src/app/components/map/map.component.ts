import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  DestroyRef,
  ElementRef,
  EventEmitter,
  Input,
  OnDestroy,
  Output,
  ViewChild,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import * as L from 'leaflet';

import { ComuneData, ComuneGeoProps } from '../../models/comune.model';
import { MetricaMappa } from '../../models/impresa.model';
import { DataService } from '../../services/data.service';
import {
  FILTRI_INIZIALI,
  FilterService,
  FilterState,
} from '../../services/filter.service';
import { MapService, PUGLIA_BOUNDS } from '../../services/map.service';
import { TemaService } from '../../services/tema.service';

/**
 * FEATURE 1 — Mappa choropleth della Puglia.
 *
 * Carica i confini comunali, colora ogni comune sulla metrica selezionata
 * (normalizzata 0-100), mostra tooltip in hover ed emette il comune cliccato
 * verso AppComponent.
 */
@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './map.component.html',
})
export class MapComponent implements AfterViewInit, OnDestroy {
  private readonly data = inject(DataService);
  private readonly mapService = inject(MapService);
  private readonly filterService = inject(FilterService);
  private readonly tema = inject(TemaService);
  private readonly destroyRef = inject(DestroyRef);

  @ViewChild('mapContainer', { static: true })
  mapContainer!: ElementRef<HTMLDivElement>;

  /** Codice ISTAT del comune selezionato, per evidenziarlo sulla mappa. */
  @Input() set selezionato(istat: string | null) {
    this._selezionato = istat;
    this.evidenziaSelezione();
  }

  /** Emesso al click su un comune presente nel dataset. */
  @Output() comuneSelezionato = new EventEmitter<ComuneData>();

  private mappa?: L.Map;
  private layerComuni?: L.GeoJSON<ComuneGeoProps>;
  private legenda?: L.Control;
  private _selezionato: string | null = null;
  private filtri: FilterState = { ...FILTRI_INIZIALI };
  /** Colore corrente di ogni comune, per ripristinarlo dopo l'hover. */
  private colori = new Map<string, string>();
  /**
   * Vero solo quando l'inquadratura e stata calcolata sui confini reali E con
   * il contenitore gia dimensionato. Finche resta falso ogni ridisegno e ogni
   * cambio di dimensione riprovano; una volta vero, si rispetta lo zoom scelto
   * dall'utente e non si reinquadra piu da soli.
   */
  private inquadrata = false;
  private osservatore?: ResizeObserver;

  /** Numero di comuni visibili con i filtri correnti. */
  readonly visibili = signal(0);

  readonly loading = this.data.loading;
  readonly error = this.data.error;

  constructor() {
    // Ridisegna quando i dati arrivano.
    effect(() => {
      if (this.data.pronto() && this.mappa) this.disegna();
    });

    // Ridisegna al cambio tema: la rampa si inverte insieme allo sfondo.
    effect(() => {
      this.tema.tema();
      if (this.mappa && this.data.pronto()) this.disegna();
    });

    // Ridisegna quando cambiano i filtri.
    this.filterService.filtri$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((f) => {
        this.filtri = f;
        if (this.mappa) this.disegna();
      });
  }

  ngAfterViewInit(): void {
    // Nessun layer di tile: la mappa disegna solo i confini comunali su una
    // tela piena. Via le etichette del basemap, via il resto d'Italia, via
    // la dipendenza da un provider esterno di mappe.
    this.mappa = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: false,
      preferCanvas: true,
      minZoom: 7,
      maxZoom: 14,
      // Zoom frazionario: l'inquadratura riempie il riquadro invece di
      // fermarsi al livello intero più vicino.
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
   * Leaflet misura il contenitore una volta sola, alla creazione, e non se ne
   * riaccorge piu da solo. Se in quel momento il riquadro e ancora a zero — il
   * chunk della mappa arriva in lazy loading, il CSS si applica in differita, la
   * scheda del browser e in secondo piano — la mappa resta vuota per sempre pur
   * avendo caricato tutti i dati, e non c'e nessun errore in console a dirlo.
   *
   * L'osservatore rende la cosa deterministica: appena il contenitore ha una
   * dimensione reale si rimisura, e se l'inquadratura precedente era stata
   * calcolata a vuoto la si rifa. Serve anche quando il riquadro cambia
   * larghezza in corsa, per esempio aprendo la sidebar dei filtri su mobile.
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

  /**
   * Inquadra la regione. Restituisce true se ha potuto usare i confini reali
   * dei comuni invece del rettangolo di ripiego.
   */
  private fit(): boolean {
    if (!this.mappa) return false;
    const bounds = this.layerComuni?.getBounds();
    const reali = !!bounds && bounds.isValid();
    this.mappa.fitBounds(reali ? bounds : PUGLIA_BOUNDS, { padding: [16, 16] });
    return reali;
  }

  /** Reinquadra finche non c'e riuscita davvero: confini reali, riquadro reale. */
  private inquadraSeServe(): void {
    if (this.inquadrata || !this.dimensionato) return;
    this.inquadrata = this.fit();
  }

  /** Bottone "Inquadra la Puglia": rimisura e reinquadra, sempre. */
  inquadraPuglia(): void {
    if (!this.mappa) return;
    this.mappa.invalidateSize({ animate: false });
    this.fit();
  }

  // -----------------------------------------------------------------
  // Disegno del choropleth
  // -----------------------------------------------------------------

  private disegna(): void {
    const geo = this.data.geo();
    if (!this.mappa || !geo) return;

    const metrica = this.filtri.metrica;
    const comuni = this.data.comuni();

    // La scala si calcola sui comuni che superano i filtri, cosi il gradiente
    // resta leggibile anche quando si guarda una singola provincia.
    const inFiltro = comuni.filter((c) => FilterService.passa(c, this.filtri));
    const base = inFiltro.length > 1 ? inFiltro : comuni;
    const ordinati = this.mapService.ordinati(base, metrica);
    const escluso = this.mapService.coloreEscluso();

    this.visibili.set(inFiltro.length);
    this.colori.clear();

    this.layerComuni?.remove();
    this.layerComuni = L.geoJSON<ComuneGeoProps>(geo as never, {
      style: (feature) => {
        const props = feature?.properties as ComuneGeoProps | undefined;
        const comune = props ? this.data.perCodice(props.istat) : undefined;
        if (!comune) return this.mapService.stile(escluso, true);

        if (!FilterService.passa(comune, this.filtri)) {
          this.colori.set(comune.istat, escluso);
          return this.mapService.stile(escluso, true);
        }

        const valore = this.mapService.valoreMetrica(comune, metrica);
        const colore = this.mapService.getColor(
          this.mapService.rango(valore, ordinati),
        );
        this.colori.set(comune.istat, colore);
        return this.mapService.stile(colore);
      },
      onEachFeature: (feature, layer) => {
        const props = feature.properties as ComuneGeoProps;
        const comune = this.data.perCodice(props.istat);
        if (!comune) return;

        layer.bindTooltip(this.mapService.tooltipComune(comune, metrica), {
          sticky: true,
          direction: 'top',
          className: 'ip-tooltip',
          opacity: 1,
        });

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
            path.setStyle(this.stileCorrente(comune.istat));
          },
          click: () => this.comuneSelezionato.emit(comune),
        });
      },
    }).addTo(this.mappa);

    this.inquadraSeServe();

    this.aggiornaLegenda(metrica, ordinati);
    this.evidenziaSelezione();
  }

  private stileCorrente(istat: string): L.PathOptions {
    const escluso = this.mapService.coloreEscluso();
    const colore = this.colori.get(istat) ?? escluso;
    const attenuato = colore === escluso;
    return istat === this._selezionato
      ? this.mapService.stileSelezionato(colore)
      : this.mapService.stile(colore, attenuato);
  }

  private evidenziaSelezione(): void {
    this.layerComuni?.eachLayer((layer) => {
      const props = (layer as L.GeoJSON & { feature?: GeoJSON.Feature }).feature
        ?.properties as ComuneGeoProps | undefined;
      if (!props) return;
      (layer as unknown as L.Path).setStyle(this.stileCorrente(props.istat));
      if (props.istat === this._selezionato) {
        (layer as unknown as L.Path).bringToFront();
      }
    });
  }

  private aggiornaLegenda(metrica: MetricaMappa, ordinati: number[]): void {
    if (!this.mappa) return;
    if (this.legenda) this.mappa.removeControl(this.legenda);

    const cfg = this.mapService.etichettaMetrica(metrica);
    this.legenda = this.mapService.creaLegenda(
      cfg.titolo,
      this.mapService.etichetteQuantili(ordinati, cfg.suffisso),
      this.mapService.scalaDensita(),
      'Classi a quantili · clicca un comune',
      this.mapService.sintesiScala(ordinati, cfg.suffisso),
    );
    this.legenda.addTo(this.mappa);
  }
}
