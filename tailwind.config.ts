import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        neon: {
          pink: "#ff2e93",
          purple: "#a855f7",
          cyan: "#22d3ee"
        },
        ink: {
          900: "#0a0a12",
          800: "#13131f",
          700: "#1f1f2e"
        }
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};

export default config;
