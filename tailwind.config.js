/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Manrope', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        ink:        'rgb(var(--c-ink)     / <alpha-value>)',
        fairway: {
          DEFAULT:  'rgb(var(--c-fw)      / <alpha-value>)',
          light:    'rgb(var(--c-fwl)     / <alpha-value>)',
          glow:     'rgb(var(--c-fwg)     / <alpha-value>)',
        },
        royal:      'rgb(var(--c-fw)      / <alpha-value>)',
        teal:       'rgb(var(--c-teal)    / <alpha-value>)',
        gold:       'rgb(var(--c-gold)    / <alpha-value>)',
        terracotta: 'rgb(var(--c-terra)   / <alpha-value>)',
        lisere:     'rgb(var(--c-lisere)  / <alpha-value>)',
        canvas:     'rgb(var(--c-canvas)  / <alpha-value>)',
        surface:    'rgb(var(--c-surface) / <alpha-value>)',
        panel:      'rgb(var(--c-panel)   / <alpha-value>)',
      },
      boxShadow: {
        soft: 'var(--shadow-soft)',
        cta:  'var(--shadow-cta)',
      },
    },
  },
  plugins: [],
};
