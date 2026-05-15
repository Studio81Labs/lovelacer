import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import VueI18nPlugin from '@intlify/unplugin-vue-i18n/vite'
import { fileURLToPath, URL } from 'node:url'

const apiProxyTarget = process.env.API_PROXY_TARGET ?? 'http://localhost:3000'

export default defineConfig({
  // Relative base so the auto-generated <script>/<link> tags in dist/index.html
  // emit ingress-friendly paths (`assets/...` instead of `/assets/...`). HA
  // Supervisor's ingress mounts the SPA under `/api/hassio_ingress/<token>/`
  // which is determined per-install at runtime; absolute paths in HTML would
  // resolve against the HA host root and 404. Same reason the API client uses
  // document-relative URLs (`api/health`) instead of `/api/health`.
  base: './',
  plugins: [
    vue(),
    tailwindcss(),
    VueI18nPlugin({
      include: [fileURLToPath(new URL('./src/locales/**', import.meta.url))],
      runtimeOnly: true,
      compositionOnly: true,
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: apiProxyTarget,
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    // The full MDI collection is intentionally emitted as a lazy chunk for the
    // room icon picker so HA add-on installs can search icons offline without
    // loading the payload during normal app startup. Keep the limit close to the
    // observed ~2.86 MB minified chunk so unrelated bundle growth still warns.
    chunkSizeWarningLimit: 3000,
  },
})
