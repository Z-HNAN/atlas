/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      boxShadow: {
        card: "0 2px 8px rgba(15, 23, 42, 0.08)",
        "card-hover": "0 8px 18px rgba(15, 23, 42, 0.12)",
      },
    },
  },
  plugins: [],
};
