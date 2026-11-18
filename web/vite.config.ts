import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true }, // resolves the "~/" import alias from tsconfig.json
  server: {
    // Forward /api to the Node API, so the browser sees one origin and we need no CORS setup.
    proxy: { "/api": "http://127.0.0.1:3001" },
  },
});
