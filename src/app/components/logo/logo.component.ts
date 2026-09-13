import { Component } from '@angular/core';

/**
 * Marchio ImpresaPuglia.
 *
 * Tessera verde con la sagoma della regione (generata dal GeoJSON reale,
 * semplificata) e tre barre oro ascendenti. Le barre reggono il marchio alle
 * dimensioni piccole, dove la sola sagoma — una fascia diagonale sottile —
 * diventerebbe illeggibile.
 *
 * Il file equivalente sta in public/logo.svg per gli usi fuori dall'app.
 */
@Component({
  selector: 'app-logo',
  standalone: true,
  template: `
    <svg viewBox="0 0 100 100" class="h-full w-full" role="img" aria-label="ImpresaPuglia">
      <rect width="100" height="100" rx="24" fill="#00653e" />
      <g transform="translate(43 44) scale(0.70) translate(-50 -50)">
        <path
          d="M4.2,31 L5.1,33.7 L7.1,34.9 L9.3,36.6 L8.8,38.2 L8.9,41.3 L10.3,41.6 L12.6,41.5 L16.7,43.4 L17.5,42 L20.5,42.3 L24.1,41.3 L25.8,40.3 L27.7,41.3 L30.6,44.5 L29,47.2 L32,48.4 L35.1,48.5 L35.8,50 L36.2,51.4 L40.7,56.3 L43.5,54.3 L48,54.8 L49.8,56.1 L49.8,60.3 L49.2,62.1 L50.3,65.3 L53.8,67.5 L54.9,66.2 L57.3,64.2 L59.2,63.4 L61,63.3 L64.5,66.1 L65.4,68.4 L67,69.1 L68.3,70 L69.5,70.2 L70.6,70.8 L71.6,71.2 L74.5,71.3 L78.8,71.5 L81.3,71.8 L83,73.6 L85.4,77.9 L85.6,78.1 L85.8,83.4 L86.1,83.6 L86.7,84.7 L87.9,85.9 L90.8,87.9 L92.9,88.3 L93.5,88.7 L94.3,89.2 L95.8,89.8 L96.4,87.4 L96.4,87.1 L96.6,86.1 L96.4,85.9 L96.7,83.8 L96.9,83.2 L97.1,82.5 L97.6,81.4 L99,79.5 L100,78.4 L97.9,73 L95.9,70.3 L94,68.3 L89.5,64.5 L88.9,64.1 L88.2,63.4 L87.5,62.5 L86.6,61.8 L85.9,58.8 L79.9,56.3 L76.4,54.1 L71.9,52.4 L68.3,49.5 L64.7,46.3 L61.5,44.1 L58.4,42.5 L50,39.2 L47.4,38.3 L44.6,37 L42.6,36 L39.4,34.1 L35.1,32.1 L30.2,29.7 L27.3,27 L26.5,24.1 L27.7,21.7 L30.6,20.1 L34.1,17.1 L34.5,12.4 L32.1,10.7 L29.2,10.2 L27.6,10.6 L24.4,11.1 L22.1,11.3 L20,11.1 L18.6,10.9 L13.1,11.9 L10.5,11.2 L7.8,11.2 L5.3,10.9 L4.4,14.5 L4.8,17.6 L5,19.6 L4,20.5 L2.2,22.3 L0,23.8 L0.5,26.2 L2,27.6 L4.2,29.4 L4.2,31 Z"
          fill="#95e9bf"
          stroke="#95e9bf"
          stroke-width="4"
          stroke-linejoin="round"
        />
      </g>
      <g fill="#00653e">
        <rect x="49" y="60" width="15" height="30" rx="5" />
        <rect x="66" y="49" width="15" height="41" rx="5" />
        <rect x="83" y="36" width="15" height="54" rx="5" />
      </g>
      <rect x="52" y="64" width="9" height="22" rx="3" fill="#B08A20" />
      <rect x="69" y="53" width="9" height="33" rx="3" fill="#D5B55F" />
      <rect x="86" y="40" width="9" height="46" rx="3" fill="#ecd28b" />
    </svg>
  `,
})
export class LogoComponent {}
