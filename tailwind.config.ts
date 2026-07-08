import type { Config } from "tailwindcss";

// Design tokens are the source of truth in src/app/globals.css (CSS variables).
// Tailwind references them so utilities and raw CSS never drift.
const config: Config = {
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: "var(--bg)",
        panel: "var(--panel)",
        line: "var(--line)",
        ice: "var(--ice)",
        "ice-dim": "var(--ice-dim)",
        violet: "var(--violet)",
        "violet-soft": "var(--violet-soft)",
        text: "var(--text)",
        muted: "var(--muted)",
        faint: "var(--faint)",
        green: "var(--green)",
        amber: "var(--amber)",
        red: "var(--red)",
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
        data: ["var(--font-data)", "ui-monospace", "monospace"],
      },
      borderRadius: {
        panel: "18px",
        card: "14px",
      },
      backgroundImage: {
        cta: "linear-gradient(135deg, var(--ice-dim), var(--violet))",
      },
    },
  },
  plugins: [],
};

export default config;
