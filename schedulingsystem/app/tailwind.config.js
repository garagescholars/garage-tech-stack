/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Custom brand colors
        'primary': {
          DEFAULT: '#2a5f5f',
          dark: '#1f4a4a',
          light: '#367070'
        },
        'accent': {
          DEFAULT: '#a8d5ba',
          dark: '#8bc4a0',
          light: '#c2e5d3'
        },
        // Override default slate to use dark theme
        'slate': {
          50: '#1a1a1a',
          100: '#2a2a2a',
          200: '#3a3a3a',
          300: '#4a4a4a',
          400: '#6a6a6a',
          500: '#8a8a8a',
          600: '#aaaaaa',
          700: '#cccccc',
          800: '#e0e0e0',
          900: '#f5f5f5',
          950: '#ffffff'
        },
        // Override blue to use teal
        'blue': {
          50: '#e6f2f2',
          100: '#cce5e5',
          200: '#99cbcb',
          300: '#66b1b1',
          400: '#4d9999',
          500: '#2a5f5f',
          600: '#1f4a4a',
          700: '#194040',
          800: '#143535',
          900: '#0f2a2a',
          950: '#0a1f1f'
        },
        // Override emerald/green to use mint accent
        'emerald': {
          50: '#f0faf5',
          100: '#c2e5d3',
          200: '#b3dfc9',
          300: '#a8d5ba',
          400: '#8bc4a0',
          500: '#6fb086',
          600: '#5a9c6e',
          700: '#458756',
          800: '#30733e',
          900: '#1b5e26'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
