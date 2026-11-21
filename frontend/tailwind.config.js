/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bronze: {
          DEFAULT: '#A0815A',
          hover: '#8C6F4B',
          muted: '#A0815A20',
        },
        sand: {
          DEFAULT: '#E1D2BB',
          light: '#F4ECE0',
          dark: '#C8B69C',
        },
        ivory: {
          DEFAULT: '#EDE8DE',
          surface: '#F8F6F2',
        },
        charcoal: {
          DEFAULT: '#181915',
          surface: '#20211D',
          border: '#2C2C26',
          muted: '#302D27',
        }
      },
      fontFamily: {
        sans: ['Inter', 'Manrope', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
