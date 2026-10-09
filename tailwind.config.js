/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        fever: {
          dark: "#0b0f17",
          card: "#131a26",
          border: "#1f293d",
          primary: "#e11d48", // Trendy Rose Crimson
          primaryHover: "#be123c",
          accent: "#f43f5e",
          gold: "#f59e0b",
          goldLight: "#fef3c7",
          emerald: "#10b981",
        },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "-apple-system", "sans-serif"],
        display: ["var(--font-outfit)", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
