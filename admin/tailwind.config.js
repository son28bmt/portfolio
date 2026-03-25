/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0a0a",
        primary: "#9d00ff",
        secondary: "#00d4ff",
        surface: "#1a1a1a",
      },
    },
  },
  plugins: [],
}
