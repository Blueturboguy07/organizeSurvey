/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'tamu-maroon': '#500000',
        'tamu-maroon-light': '#7D0000',
        'tamu-white': '#FFFFFF',
      },
    },
  },
  plugins: [],
}

