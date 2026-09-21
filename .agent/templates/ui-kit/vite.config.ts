import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            // Path alias to import CDS-generated types from root @cds-models folder
            "#cds-models": path.resolve(__dirname, "../../@cds-models"),
        },
    },
    plugins: [
        tailwindcss(),
        react(),
    ],
    server: {
        proxy: {
            // Proxy API calls to CAP backend
            '/odata/v4': {
                target: 'http://localhost:4004',
                changeOrigin: true,
            },
            '/browse': {
                target: 'http://localhost:4004',
                changeOrigin: true,
            },
            '/admin': {
                target: 'http://localhost:4004',
                changeOrigin: true,
            }
        }
    }
})
