/**
 * I colori sono variabili CSS definite in src/styles.scss, una coppia di
 * valori per tema. Le classi nei template restano le stesse in chiaro e in
 * scuro: cambia il valore sotto, non la classe.
 *
 * La forma `rgb(var(--x) / <alpha-value>)` serve a mantenere funzionanti le
 * utility con opacità, tipo `bg-up/10`.
 */
const token = (nome) => `rgb(var(--c-${nome}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        // Superfici
        canvas: token('canvas'),
        shell: token('shell'),
        'shell-2': token('shell-2'),
        'shell-3': token('shell-3'),
        panel: token('panel'),
        surface: token('surface'),
        card: token('card'),
        line: token('line'),

        // Testo
        ink: token('ink'),
        'ink-soft': token('ink-soft'),
        'ink-dim': token('ink-dim'),

        // Marchio: verde denaro
        brand: token('brand'),
        'brand-2': token('brand-2'),
        'brand-ink': token('brand-ink'),
        mint: token('mint'),
        'mint-pale': token('mint-pale'),

        // Oro: capitale, opportunità
        gold: token('gold'),
        'gold-ink': token('gold-ink'),
        'gold-2': token('gold-2'),
        'gold-pale': token('gold-pale'),

        // Variazioni di mercato
        up: token('up'),
        down: token('down'),
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        panel: 'var(--ombra-pannello)',
      },
      spacing: {
        // larghezza del pannello di dettaglio + margine
        panel: '25.5rem',
      },
      letterSpacing: {
        wider2: '0.08em',
      },
    },
  },
  plugins: [],
};
