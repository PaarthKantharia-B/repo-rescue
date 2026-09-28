import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a8a",
        },
        dark: {
          bg: "#070a11",
          card: "#0d111c",
          border: "#1e293b",
          subtle: "#161e2e",
        },
        difficulty: {
          easy: "#10b981",    // 0.0 - 3.4
          medium: "#3b82f6",  // 3.5 - 6.4
          hard: "#8b5cf6",    // 6.5 - 8.4
          expert: "#f59e0b",  // 8.5 - 9.4
          grandmaster: "#ef4444" // 9.5 - 10.0
        }
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-mono)", "JetBrains Mono", "monospace"],
      },
      boxShadow: {
        'glow-easy': '0 0 20px -3px rgba(16, 185, 129, 0.3)',
        'glow-medium': '0 0 20px -3px rgba(59, 130, 246, 0.3)',
        'glow-hard': '0 0 20px -3px rgba(139, 92, 246, 0.3)',
        'glow-expert': '0 0 20px -3px rgba(245, 158, 11, 0.3)',
        'glow-grandmaster': '0 0 20px -3px rgba(239, 68, 68, 0.3)',
        'glow-brand': '0 0 25px -4px rgba(59, 130, 246, 0.35)',
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        reporescue: {
          "primary": "#3b82f6",
          "secondary": "#8b5cf6",
          "accent": "#f59e0b",
          "neutral": "#1e293b",
          "base-100": "#070a11",
          "base-200": "#0d111c",
          "base-300": "#161e2e",
          "info": "#06b6d4",
          "success": "#10b981",
          "warning": "#f59e0b",
          "error": "#ef4444",
        },
      },
      "dark",
    ],
    darkTheme: "reporescue",
  },
};

export default config;
