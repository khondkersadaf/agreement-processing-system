/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Brand palette — teal is the primary action color
      colors: {
        brand: {
          50:  "#E0F5F3",
          100: "#B3E6E2",
          200: "#80D5CF",
          400: "#2EBDB1",
          500: "#1EA99D",
          600: "#0D9488",
          700: "#0A7A70",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card:  "0 1px 3px rgba(0,0,0,0.06),0 1px 2px rgba(0,0,0,0.04)",
        modal: "0 0 0 1px rgba(0,0,0,0.06),0 8px 16px rgba(0,0,0,0.08),0 24px 48px rgba(0,0,0,0.12)",
        toast: "0 4px 6px rgba(0,0,0,0.06),0 10px 24px rgba(0,0,0,0.10)",
        btn:   "0 1px 2px rgba(0,0,0,0.08),inset 0 1px 0 rgba(255,255,255,0.12)",
      },
      keyframes: {
        fadeIn:  { from: { opacity: "0" }, to: { opacity: "1" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.96) translateY(6px)" }, to: { opacity: "1", transform: "scale(1) translateY(0)" } },
        slideUp: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        toastIn: { from: { opacity: "0", transform: "translateX(-50%) translateY(10px)" }, to: { opacity: "1", transform: "translateX(-50%) translateY(0)" } },
      },
      animation: {
        "fade-in":  "fadeIn 0.2s ease both",
        "scale-in": "scaleIn 0.22s cubic-bezier(0.34,1.2,0.64,1) both",
        "slide-up": "slideUp 0.25s ease both",
        "toast-in": "toastIn 0.25s cubic-bezier(0.34,1.2,0.64,1) both",
      },
    },
  },
  plugins: [],
};
