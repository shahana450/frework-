/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx,ts,tsx}', './components/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        navy: '#08112A',
        navy2: '#0F2044',
        'fw-blue': '#2563EB',
        'fw-blue-l': '#60A5FA',
        'fw-violet': '#A78BFA',
        'fw-emerald': '#34D399',
        'fw-amber': '#FCD34D',
        'fw-orange': '#FB923C',
      },
      fontFamily: {
        sans: ['System'],
      },
    },
  },
  plugins: [],
};
