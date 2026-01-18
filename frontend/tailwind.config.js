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
          50: '#f9fafb', // Very light gray
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#111827', // Almost black (Gray 900) - Main brand color
          700: '#000000', // Black
          800: '#000000',
          900: '#000000',
        },
      },
    },
  },
  plugins: [],
}
