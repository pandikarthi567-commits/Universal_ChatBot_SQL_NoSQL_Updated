/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        charcoal: {
          950: "#0D0E10",
          900: "#17191C", // Midnight Charcoal (Base)
          850: "#1E2125",
          800: "#25292F",
          750: "#2D323A",
          700: "#373E47",
        },
        steel: {
          300: "#B8C0C7",
          400: "#929DA7", // Cool Steel Grey
          500: "#75808B",
          600: "#5B646D",
        },
        coral: {
          400: "#FF6753",
          500: "#FF4832", // Vibrant Coral Orange
          600: "#E63A25",
          700: "#C42916",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ["Space Grotesk", "Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      animation: {
        "pulse-slow": "pulse 6s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 8s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-14px)" },
        },
      },
    },
  },
  plugins: [],
};
