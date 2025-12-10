import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/nvidia-gpu-analyzer/', // Base path for GitHub Pages
  build: {
    outDir: '../docs',
    emptyOutDir: true, // Empty the output directory before building
    rollupOptions: {
      output: {
        // Use manual chunking to consolidate files
        manualChunks: {
          vendor: ['react', 'react-dom', 'd3'],
          // Group all the application code in a single chunk
          app: ['./src/main.jsx', './src/App.jsx', './src/CudaPlot.jsx', './src/DieAreaPlot.jsx', './src/VramPlot.jsx']
        },
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash].[ext]'
      }
    }
  }
})
