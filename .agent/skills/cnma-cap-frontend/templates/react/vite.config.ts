import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from 'path'

// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],

    // 1. CRITICAL: Forces relative paths for assets. 
    // Required because the app is hosted at a sub-path on BTP (e.g., /approuter.id/index.html).
    base: './',

    resolve: {
        alias: {
            '@': path.resolve(__dirname, './src'),
        },
        dedupe: ['react', 'react-dom']
    },

    build: {
        // 2. Output directory. Ensure your mta.yaml points to this folder.
        outDir: 'dist',
        emptyOutDir: true,
        // Optional: useful for debugging issues on BTP if needed, but increases build size.
        sourcemap: false
    },

    server: {
        // 3. PROXY: Connects local React app to the backend (CAP or S/4) during 'npm run dev'.
        // This configuration mimics the routing behavior of xs-app.json.
        proxy: {
            // Matches the path you use in axios calls (e.g., axios.get('/api/cnma/...'))
            '/api': {
                // TARGET: 
                // If connecting to local CAP: 'http://localhost:4004'
                // If connecting to S/4 (via VPN/Cloud Connector locally): 'https://vhost:port'
                target: 'http://localhost:4004',

                changeOrigin: true,
                secure: false, // Set to false if using self-signed certs (common in local SAP dev)
            },
            // Proxy local logs service (if different)
            '/log': {
                target: 'http://localhost:4004',
                changeOrigin: true,
                secure: false
            }
        }
    },
})
