import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7f1',
          100: '#d6ecdd',
          500: '#1f9d55',
          600: '#188047',
          700: '#136539',
        },
      },
    },
  },
  plugins: [],
};

export default config;
