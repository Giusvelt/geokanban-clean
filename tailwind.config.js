/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#0058be',
          container: '#d9e2ff',
        },
        secondary: {
          DEFAULT: '#6b38d4',
          container: '#e9ddff',
        },
        surface: {
          DEFAULT: '#f7f9fb',
          low: '#f2f4f6',
          lowest: '#ffffff',
          bright: '#f7f9fb',
        }
      },
      borderRadius: {
        'xl': '1.5rem', // 24px
        'lg': '1rem',   // 16px
      },
      fontFamily: {
          manrope: ['Manrope', 'sans-serif'],
          inter: ['Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
