import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Aura — Vite config con code-splitting agresivo y target moderno (Android Chrome >= 90)
export default defineConfig({
  plugins: [react()],
  esbuild: {
    legalComments: 'none',
    target: 'es2020',
  },
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    minify: 'esbuild',
    reportCompressedSize: false,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        // Chunks por funcionalidad — el bundle inicial sólo carga react + el shell
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react-dom')) return 'vendor-react-dom'
            if (id.includes('react')) return 'vendor-react'
            return 'vendor'
          }
          if (id.includes('/src/voiceNotes') || id.includes('/src/notesSearch')) return 'feature-notes'
          if (id.includes('/src/timeline')) return 'feature-timeline'
          if (id.includes('/src/summary')) return 'feature-summary'
        },
      },
    },
  },
  server: { host: true },
})
