import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        rose: {
          50: '#fdf2f8',
          400: '#fb7185',
          500: '#f43f5e',
          600: '#e11d48',
        },
        pink: {
          400: '#f472b6',
          500: '#ec4899',
        }
      },
      fontFamily: {
        serif: ['Playfair Display', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config;
