import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'

// One self-contained index.html (works when double-clicked and on GitHub Pages).
// base './' keeps paths relative so the site works under https://<user>.github.io/<repo>/
export default defineConfig({
  base: './',
  plugins: [react(), viteSingleFile()],
  build: { minify: true },
  test: { environment: 'jsdom' }
})
