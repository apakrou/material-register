import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { Agent } from "node:http";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [tailwindcss(), reactRouter()],
  resolve: { tsconfigPaths: true }, // resolves the "~/" import alias from tsconfig.json
  server: {
    // Forward /api to the Node API, so the browser sees one origin and we need no CORS setup.
    proxy: {
      "/api": {
        // 127.0.0.1 rather than "localhost", which can resolve to IPv6 (::1) on macOS.
        target: "http://127.0.0.1:3001",
        // Don't reuse idle connections. Otherwise the proxy can reuse a socket the API has
        // just closed (Node's 5s keep-alive timeout) and the request fails with a 502.
        agent: new Agent({ keepAlive: false }),
      },
    },
  },
});
