const { colors } = require('./scripts/design-tokens.cjs');

/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      fontFamily: {
        sans: ['Geist_400Regular'],
        'sans-medium': ['Geist_500Medium'],
        'sans-semibold': ['Geist_600SemiBold'],
        'sans-bold': ['Geist_700Bold'],
        mono: ['GeistMono_400Regular'],
        display: ['Newsreader_400Regular'],
        'display-italic': ['Newsreader_400Regular_Italic'],
      },
      borderRadius: { xs: '4px', sm: '6px', md: '8px', lg: '10px', xl: '14px', card: '12px', segment: '7px' },
    },
  },
  future: { hoverOnlyWhenSupported: true },
  plugins: [require('tailwindcss-animate')],
};
