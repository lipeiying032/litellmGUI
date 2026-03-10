/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["'IBM Plex Sans'", "system-ui", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
        display: ["'Space Grotesk'", "sans-serif"],
      },
      colors: {
        surface: {
          0: "#050709",
          1: "#0d1117",
          2: "#161b22",
          3: "#21262d",
          4: "#30363d",
        },
        accent: {
          green: "#00ff87",
          cyan: "#00d4ff",
          purple: "#a855f7",
          orange: "#ff6b35",
          red: "#ff4757",
        },
        text: {
          primary: "#e6edf3",
          secondary: "#8b949e",
          muted: "#484f58",
        },
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "slide-in": "slideIn 0.2s ease-out",
        "fade-in": "fadeIn 0.3s ease-out",
        glow: "glow 2s ease-in-out infinite alternate",
      },
      keyframes: {
        slideIn: {
          from: { transform: "translateY(-8px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        fadeIn: {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        glow: {
          from: { boxShadow: "0 0 5px rgba(0,255,135,0.3)" },
          to: { boxShadow: "0 0 20px rgba(0,255,135,0.6)" },
        },
      },
    },
  },
  plugins: [],
};
