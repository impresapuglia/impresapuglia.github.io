import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';

import { ComuneData } from '../../models/comune.model';
import { UiService } from '../../services/ui.service';
import { ComunePanelComponent } from '../comune-panel/comune-panel.component';
import { MapComponent } from '../map/map.component';

/**
 * Vista principale: mappa choropleth a tutto schermo con il pannello di
 * dettaglio che entra da destra quando si clicca un comune.
 */
@Component({
  selector: 'app-map-page',
  standalone: true,
  imports: [CommonModule, MapComponent, ComunePanelComponent],
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
