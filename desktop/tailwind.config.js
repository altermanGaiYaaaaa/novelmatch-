/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          "Inter",
          "PingFang SC",
          "Hiragino Sans GB",
          "Microsoft YaHei",
          "sans-serif",
        ],
      },
      colors: {
        ink: "#1D1B2B",
        brand: {
          50: "#F6F3FF",
          100: "#EFEBFF",
          200: "#E4DEFF",
          300: "#CFC7F2",
          400: "#9A8DEE",
          500: "#6C5CE7",
          600: "#5B4BD6",
          700: "#4C3DC4",
          800: "#3F319F",
        },
      },
      boxShadow: {
        card: "0 18px 44px -34px rgba(44,36,96,0.45)",
        panel: "0 28px 70px -38px rgba(44,36,96,0.38)",
      },
      keyframes: {
        "fade-up": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "toast-in": {
          from: { opacity: "0", transform: "translate(-50%, 10px)" },
          to: { opacity: "1", transform: "translate(-50%, 0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.32s ease-out both",
        "toast-in": "toast-in 0.2s ease-out both",
      },
    },
  },
  plugins: [],
};
