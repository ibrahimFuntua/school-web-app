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
          DEFAULT: "#1E3A8A",
          light: "#2F52B0",
          dark: "#162C6B",
        },
        accent: {
          DEFAULT: "#F59E0B",
          light: "#FBB83A",
          dark: "#D97706",
        },
        background: "#F8FAFC",
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
}