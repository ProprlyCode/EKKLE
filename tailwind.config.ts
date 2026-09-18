import type { Config } from 'tailwindcss';

/**
 * Ekklē brand tokens (platform/chrome level).
 * Muted, earthy, warm — see brand guidelines. Colors are exposed as CSS
 * variables in index.css and referenced here so a rebrand is a one-file change.
 */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Deep sage green — primary text / dark accent
        sage: {
          DEFAULT: 'var(--color-sage)',
          soft: 'var(--color-sage-soft)',
        },
        // Warm neutrals
        canvas: 'var(--color-canvas)', // warm off-white background
        card: 'var(--color-card)', // soft cream card surface
        edge: 'var(--color-edge)', // muted tan border
        muted: {
          DEFAULT: 'var(--color-muted)', // warm gray-brown secondary text
          strong: 'var(--color-muted-strong)',
        },
      },
      fontFamily: {
        // Wordmark / headlines — editorial serif
        serif: ['Fraunces', 'Georgia', 'serif'],
        // Body / UI — quiet sans
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      letterSpacing: {
        eyebrow: '0.14em',
      },
      borderRadius: {
        card: '0.75rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
