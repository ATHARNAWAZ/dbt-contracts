import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      // Proxy API calls to the FastAPI backend in development
      '/api': {
        target: process.env['VITE_API_URL'] ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    // Monaco editor workers need to be able to load from the root
    rollupOptions: {
      output: {
        manualChunks: {
          // Split Monaco into its own chunk — it's ~3 MB and rarely changes
          'monaco-editor': ['monaco-editor'],
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'framer-motion': ['framer-motion'],
        },
      },
    },
  },
})
