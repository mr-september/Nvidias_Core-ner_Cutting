import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/Nvidias_Core-ner_Cutting/', // Base path for GitHub Pages
  build: {
    outDir: '../docs'
  }
})
