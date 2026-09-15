import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { ComuneData } from '../../models/comune.model';
import { UiService } from '../../services/ui.service';
import { ComunePanelComponent } from '../comune-panel/comune-panel.component';
import { MapComponent } from '../map/map.component';
import { RiepilogoComponent } from '../riepilogo/riepilogo.component';

/**
 * Vista principale: mappa choropleth a tutto schermo con il dettaglio del
 * comune, che da lg in su entra da destra e su telefono sale dal basso.
 */
@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, MapComponent, ComunePanelComponent, RiepilogoComponent],
  templateUrl: './map-page.component.html',
})
export class MapPageComponent {
  private readonly ui = inject(UiService);

  readonly comune = this.ui.comuneSelezionato;

  onComuneSelezionato(c: ComuneData): void {
    this.ui.seleziona(c);
  }

  chiudiPannello(): void {
    this.ui.chiudiPannello();
  }
}
