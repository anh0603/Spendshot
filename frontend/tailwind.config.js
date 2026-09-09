/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "#FF6B35",
        "primary-hover": "#E55A2B",
        "primary-light": "#FFF1EB",
        bg: "#FAFBFC",
        surface: "#FFFFFF",
        "text-primary": "#111827",
        "text-secondary": "#6B7280",
        border: "#E5E7EB",
        success: "#10B981",
        warning: "#F59E0B",
        danger: "#EF4444",
        info: "#3B82F6",
      },
      fontFamily: {
        sans: ["Be Vietnam Pro", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        button: "12px",
        modal: "20px",
        sheet: "24px",
        fab: "28px",
      },
      boxShadow: {
        sm: "0 1px 2px rgba(0,0,0,0.05)",
        md: "0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.06)",
        lg: "0 10px 15px -3px rgba(0,0,0,0.08)",
      },
      spacing: {
        18: "4.5rem",
      },
    },
  },
  plugins: [],
}
