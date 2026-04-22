/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        display: ['"Orbitron"', 'sans-serif'],   // futuristic headings
        body:    ['"Exo 2"',   'sans-serif'],    // clean body text
        mono:    ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        // Core palette
        void:    '#030712',   // deepest background
        surface: '#0d1117',   // card backgrounds
        glass:   'rgba(255,255,255,0.04)',

        // Neon accents
        neon: {
          cyan:    '#00f5ff',
          purple:  '#b347ff',
          green:   '#00ff88',
          amber:   '#ffb800',
        },

        // Semantic
        border: 'rgba(0,245,255,0.12)',
      },
      backgroundImage: {
        'grid-pattern': `
          linear-gradient(rgba(0,245,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(0,245,255,0.03) 1px, transparent 1px)
        `,
        'hero-glow': 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(0,245,255,0.12), transparent)',
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
      boxShadow: {
        'neon-cyan':   '0 0 20px rgba(0,245,255,0.2), 0 0 60px rgba(0,245,255,0.05)',
        'neon-purple': '0 0 20px rgba(179,71,255,0.2), 0 0 60px rgba(179,71,255,0.05)',
        'glass':       'inset 0 1px 0 rgba(255,255,255,0.06)',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4,0,0.6,1) infinite',
        'shimmer':    'shimmer 2.5s linear infinite',
        'float':      'float 6s ease-in-out infinite',
      },
      keyframes: {
        shimmer: {
          '0%':   { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition:  '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%':      { transform: 'translateY(-8px)' },
        },
      },
    },
  },
  plugins: [],
}
