import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
  },
  // Pre-bundle the heavy PDF + DOCX deps on dev server start instead of paying
  // the cost on the first user click. Without this, the first attach of a PDF
  // can take 10-15s in dev mode while Vite traverses pdfjs-dist's tree.
  optimizeDeps: {
    include: ["pdfjs-dist/legacy/build/pdf.mjs", "mammoth"],
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
    // Build target: Vercel's Node serverless runtime. TanStack Start (via
    // Nitro under the hood) auto-detects Vercel from process.env.VERCEL at
    // build time and emits the right output layout. No explicit preset needed.
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
    // Nitro builds the server bundle into a deploy-target-aware layout.
    // On Vercel CI the VERCEL env var is set and Nitro auto-selects its
    // `vercel` preset, emitting .vercel/output/ — Vercel ingests that
    // directly. Locally it just produces a Node server.
    nitro(),
    viteReact(),
  ],
}));
