import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  // Relative base so the auto-generated <script>/<link> tags in dist/index.html
  // emit ingress-friendly paths (`assets/...` instead of `/assets/...`). HA
  // Supervisor's ingress mounts the SPA under `/api/hassio_ingress/<token>/`
  // which is determined per-install at runtime; absolute paths in HTML would
  // resolve against the HA host root and 404. Same reason the API client uses
  // document-relative URLs (`api/health`) instead of `/api/health`.
  base: './',
  plugins: [vue(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})
