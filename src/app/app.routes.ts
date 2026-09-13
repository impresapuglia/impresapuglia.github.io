import { Routes } from '@angular/router';

/**
 * Il sito parte dalla pagina di benvenuto; le due viste di mappa e la guida
 * sono caricate in lazy dentro la shell definita da AppComponent.
 */
export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    title: "ImpresaPuglia — l'imprenditoria pugliese sulla mappa",
    loadComponent: () =>
      import('./components/welcome/welcome.component').then(
        (m) => m.WelcomeComponent,
      ),
  },
  {
    path: 'mappa',
    title: "ImpresaPuglia — mappa dell'imprenditoria",
    loadComponent: () =>
      import('./components/map-page/map-page.component').then(
        (m) => m.MapPageComponent,
      ),
  },
  {
    path: 'opportunita',
    title: 'ImpresaPuglia — mappa delle opportunità',
    loadComponent: () =>
      import('./components/opportunity-map/opportunity-map.component').then(
        (m) => m.OpportunityMapComponent,
      ),
  },
  {
    path: 'guida',
    title: "ImpresaPuglia — cos'è e come si legge",
    loadComponent: () =>
      import('./components/guida/guida.component').then((m) => m.GuidaComponent),
  },
  { path: '**', redirectTo: '' },
];
