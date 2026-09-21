import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import * as path from 'path'

export default defineConfig({
    plugins: [
        react(),
        tailwindcss(), // Tailwind v4 — no postcss.config needed
    ],
    base: './',
    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        dedupe: ['react', 'react-dom'],
    },
    build: {
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: false,
    },
    server: {
        proxy: {
            '/odata': {
                target: 'http://localhost:4004',
                changeOrigin: true,
                secure: false,
                headers: { Authorization: 'Basic YWRtaW46' },
            },
            '/api/cnma': {
                target: 'http://localhost:4004',
                changeOrigin: true,
                secure: false,
                headers: { Authorization: 'Basic YWRtaW46' },
            },
        },
    },
})
