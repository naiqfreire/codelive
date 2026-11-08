/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        background: '#0F172A',
        foreground: '#F8FAFC',
        surface: '#1B2336',
        border: '#475569',
        muted: '#272F42',
        'muted-foreground': '#94A3B8',
        primary: '#1E293B',
        secondary: '#334155',
        accent: '#22C55E',
        'accent-foreground': '#0F172A',
        destructive: '#EF4444',
        ring: '#FFFFFF',
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(34, 197, 94, 0.25)',
      },
    },
  },
  plugins: [],
}
