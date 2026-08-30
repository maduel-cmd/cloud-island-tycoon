/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        sky: {
          deep: "#1a120b",
          mid: "#6b4e16",
          soft: "#a89878",
          mist: "#2a2016",
        },
        grass: {
          bright: "#4a7c35",
          mid: "#3d6b28",
          dark: "#2a4a1c",
        },
        wow: {
          panel: "#1a1410",
          gold: "#e8c547",
          border: "#8b6914",
          parchment: "#e8d5a8",
          xp: "#7a3bb8",
        },
        cloud: "#e8d5a8",
        coin: "#e8c547",
        danger: "#a33b2c",
        panel: "rgba(26,20,16,0.92)",
      },
      fontFamily: {
        display: ["Cinzel", "Heebo", "Segoe UI", "sans-serif"],
        body: ["Heebo", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        glass: "0 8px 32px rgba(0,0,0,0.45), inset 0 1px 0 rgba(232,197,71,0.15)",
        float: "0 12px 40px rgba(0,0,0,0.55)",
      },
      animation: {
        "float-y": "floatY 4s ease-in-out infinite",
        "pulse-soft": "pulseSoft 2.4s ease-in-out infinite",
      },
      keyframes: {
        floatY: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        pulseSoft: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
      },
    },
  },
  plugins: [],
};
