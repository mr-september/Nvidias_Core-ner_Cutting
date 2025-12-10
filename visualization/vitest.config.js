import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
    plugins: [react()],
    test: {
        globals: true,
        environment: 'happy-dom',
        setupFiles: './src/test/setup.js',
        include: ['src/**/*.{test,spec}.{js,jsx}'],
    },
})
