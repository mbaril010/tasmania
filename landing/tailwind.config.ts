import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        tasmania: {
          indigo: "#6366f1",
          "indigo-light": "#818cf8",
          dark: "#0f0f0f",
          "dark-secondary": "#1a1a1a",
          "dark-tertiary": "#252525",
        },
      },
    },
  },
  plugins: [],
};
export default config;
