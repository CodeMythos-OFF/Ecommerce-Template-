import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Configure middleware to handle SPA routing
    middlewareMode: false,
  },
  build: {
    // Keep production JavaScript and CSS minified and omit source maps.
    minify: 'esbuild',
    cssMinify: true,
    sourcemap: false,
  },
})
