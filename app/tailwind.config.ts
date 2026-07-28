import type { Config } from 'tailwindcss';

/**
 * Design system: "Dark Mode (OLED)" — deep-black canvas, blue data, amber CTA.
 * Type pairing: Fira Code (display/technical) + Fira Sans (body).
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        // Canvas — near-black so the WebGL arena bleeds into the page.
        pit: {
          950: '#04060B',
          900: '#080C14',
          850: '#0B111C',
          800: '#0E1420',
          700: '#161E2E',
          600: '#1E293B',
          500: '#2C3A50',
        },
        // Data / primary
        volt: {
          DEFAULT: '#3B82F6',
          deep: '#1E40AF',
          light: '#60A5FA',
          glow: '#93C5FD',
        },
        // CTA / highlight
        ember: {
          DEFAULT: '#F59E0B',
          light: '#FBBF24',
          deep: '#B45309',
        },
        win: '#22C55E',
        lose: '#EF4444',
        ink: {
          DEFAULT: '#E8EEF9',
          soft: '#A8B6CC',
          mute: '#6F7F97',
        },
      },
      fontFamily: {
        display: ['var(--font-fira-code)', 'ui-monospace', 'monospace'],
        mono: ['var(--font-fira-code)', 'ui-monospace', 'monospace'],
        sans: ['var(--font-fira-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        // "Minimal glow" per the OLED style guidance — restrained, not neon soup.
        volt: '0 0 0 1px rgba(59,130,246,0.35), 0 0 24px -6px rgba(59,130,246,0.45)',
        ember: '0 0 0 1px rgba(245,158,11,0.4), 0 0 28px -6px rgba(245,158,11,0.5)',
        panel: '0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px rgba(0,0,0,0.9)',
      },
      backgroundImage: {
        grid: `linear-gradient(rgba(59,130,246,0.07) 1px, transparent 1px),
               linear-gradient(90deg, rgba(59,130,246,0.07) 1px, transparent 1px)`,
      },
      backgroundSize: {
        grid: '48px 48px',
      },
      keyframes: {
        'sweep': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(200%)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(245,158,11,0.5)' },
          '70%': { boxShadow: '0 0 0 12px rgba(245,158,11,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(245,158,11,0)' },
        },
        'rise': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'ticker': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
      },
      animation: {
        sweep: 'sweep 2.4s ease-in-out infinite',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        rise: 'rise 0.5s cubic-bezier(0.16,1,0.3,1) both',
        ticker: 'ticker 40s linear infinite',
      },
    },
  },
  plugins: [],
};

export default config;
