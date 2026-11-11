import { existsSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

const setupClientId = "\0setup-client";
const setupServerId = "\0setup-server";

function setupFallbackPlugin(target: "client" | "server"): Plugin {
  const virtualId = target === "client" ? setupClientId : setupServerId;

  return {
    name: `setup-${target}-fallback`,
    resolveId(id) {
      return id === virtualId ? virtualId : undefined;
    },
    load(id) {
      if (id !== virtualId) {
        return undefined;
      }

      return target === "client"
        ? "document.querySelector('#root');"
        : "export {};";
    },
    generateBundle() {
      if (target === "client" && !existsSync("index.html")) {
        this.emitFile({
          type: "asset",
          fileName: "index.html",
          source:
            '<!doctype html><html lang="zh-CN"><body><div id="root"></div></body></html>',
        });
      }
    },
  };
}

export default defineConfig(({ mode }) => {
  const serverBuild = mode === "server";
  const sourceEntry = serverBuild ? "src/server/index.ts" : "index.html";
  const fallbackEntry = serverBuild ? setupServerId : setupClientId;

  return {
    plugins: [react(), setupFallbackPlugin(serverBuild ? "server" : "client")],
    build: {
      outDir: serverBuild ? "dist/server" : "dist/client",
      emptyOutDir: !serverBuild,
      ssr: serverBuild,
      rollupOptions: {
        input: existsSync(sourceEntry) ? sourceEntry : fallbackEntry,
        output: serverBuild ? { entryFileNames: "index.js" } : undefined,
      },
    },
  };
});
