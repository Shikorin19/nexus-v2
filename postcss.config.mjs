// PostCSS config — Tailwind v4 is handled by @tailwindcss/vite plugin in vite.config.js
// Only autoprefixer is needed here for any remaining vendor-prefix transforms.
export default {
  plugins: {
    autoprefixer: {},
  },
};
