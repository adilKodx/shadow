import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5180,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      onwarn(warning, warn) {
        if (
          warning.message.includes('Module level directives') ||
          warning.message.includes('"use client"')
        ) {
          return;
        }
        if (warning.code === 'UNRESOLVED_IMPORT') {
          throw new Error(`Build failed: unresolved import:\n${warning.message}`);
        }
        warn(warning);
      },
    },
  },
});
