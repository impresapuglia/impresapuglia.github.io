import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet,
} from '@angular/router';
import { filter } from 'rxjs';

import { ChatbotComponent } from './components/chatbot/chatbot.component';
import { FilterPanelComponent } from './components/filter-panel/filter-panel.component';
import { LogoComponent } from './components/logo/logo.component';
import { DataService } from './services/data.service';
import { TemaService } from './services/tema.service';
import { UiService } from './services/ui.service';

/**
 * Shell dell'applicazione.
 *
 * Le pagine di contenuto (benvenuto, guida) occupano tutta l'area centrale;
 * sidebar dei filtri e bottone dell'assistente compaiono solo sulle due viste
 * di mappa, dove hanno senso.
 */
@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    FilterPanelComponent,
    ChatbotComponent,
    LogoComponent,
  ],
  templateUrl: './app.component.html',
})
export class AppComponent implements OnInit {
  private readonly data = inject(DataService);
  private readonly router = inject(Router);
  readonly ui = inject(UiService);
  readonly tema = inject(TemaService);

  /** La sidebar filtri è aperta (su mobile è a scomparsa). */
  sidebarAperta = false;

  private readonly rotta = signal(this.router.url);

  /** True sulle viste di mappa: solo lì servono filtri e assistente. */
  readonly vistaMappa = computed(() => {
    const u = this.rotta();
    return u.startsWith('/mappa') || u.startsWith('/opportunita');
  });

  constructor() {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((e) => {
        this.rotta.set(e.urlAfterRedirects);
        this.sidebarAperta = false;
        // Uscendo dalla mappa il pannello di dettaglio non ha più un contesto.
        if (!this.vistaMappa()) {
          this.ui.chiudiPannello();
          this.ui.chiudiChat();
        }
      });
  }

  ngOnInit(): void {
    this.data.load();
  }

  toggleSidebar(): void {
    this.sidebarAperta = !this.sidebarAperta;
  }

  chiudiSidebar(): void {
    this.sidebarAperta = false;
  }
}
