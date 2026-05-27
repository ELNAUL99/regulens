import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig(({ command }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  // Pre-bundle the heavy PDF + DOCX deps on dev server start instead of paying
  // the cost on the first user click. Without this, the first attach of a PDF
  // can take 10-15s in dev mode while Vite traverses pdfjs-dist's tree.
  optimizeDeps: {
    include: ["pdfjs-dist", "mammoth"],
  },
  resolve: {
    alias: { "@": `${process.cwd()}/src` },
    dedupe: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@tanstack/query-core",
    ],
  },
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    // Cloudflare adapter only kicks in for the production build; in `vite dev`
    // we run on Node so it's intentionally omitted.
    ...(command === "build" ? [cloudflare()] : []),
    tanstackStart({
      server: { entry: "server" },
      importProtection: {
        behavior: "error",
        client: {
          files: ["**/server/**"],
          specifiers: ["server-only"],
        },
      },
    }),
    viteReact(),
  ],
}));
