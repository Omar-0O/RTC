import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import fs from "fs";

import { cloudflare } from "@cloudflare/vite-plugin";

const buildVersion = `build-${Date.now()}`;

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), {
    name: "inject-sw-version",
    closeBundle() {
      try {
        const swPath = path.resolve(__dirname, "dist/sw.js");
        if (fs.existsSync(swPath)) {
          let content = fs.readFileSync(swPath, "utf-8");
          // Replace the hardcoded version line in the bundled output
          content = content.replace(
            /const CACHE_VERSION = 'v3';/,
            `const CACHE_VERSION = '${buildVersion}';`
          );
          fs.writeFileSync(swPath, content, "utf-8");
          console.log(`[inject-sw-version] Successfully injected CACHE_VERSION = ${buildVersion} into dist/sw.js`);
        } else {
          console.warn("[inject-sw-version] dist/sw.js not found");
        }
      } catch (error) {
        console.error("[inject-sw-version] Failed to inject SW version:", error);
      }
    },
  }, cloudflare()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Letting Vite handle chunking automatically to avoid linking issues
      },
    },
  },
}));