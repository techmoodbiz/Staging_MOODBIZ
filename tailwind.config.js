import typography from '@tailwindcss/typography';

/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0F2C62', // Updated from user image
          light: '#0b1735ff',
          dark: '#000000ff',
        },
        cyan: {
          DEFAULT: '#0ea5e9', // Sky-500: More professional blue-cyan than pure cyan
          light: '#38bdf8',   // Sky-400
          dark: '#0284c7',    // Sky-600
        },
        slate: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a', // Explicit slate palette for consistency
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
        head: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'premium': '0 20px 40px -12px rgba(15, 23, 42, 0.1)', // Softer, more diffuse
        'soft': '0 10px 30px -10px rgba(0, 0, 0, 0.05)',
        'gleam': '0 0 15px 0 rgba(14, 165, 233, 0.15)', // Using new cyan color
        'inner-soft': 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.02)',
      },
      borderRadius: {
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      animation: {
        'fade-in': 'fadeIn 0.4s ease-out',
        'slide-up': 'slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-up': 'slideInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        }
      }
    },
  },
  plugins: [
    typography,
  ],
}
