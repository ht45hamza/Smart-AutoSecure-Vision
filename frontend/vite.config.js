import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    // Base must match where Django serves these files
    base: '/static/dist/',
    build: {
        // Build directly into Django's static files
        outDir: '../static/dist',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            // By default Vite uses index.html as entry
            // This ensures index.html is generated in the dist folder
        }
    },
    server: {
        origin: 'http://localhost:5175',
        port: 5175,
        proxy: {
            '/api': 'http://127.0.0.1:8000',
            '/admin': 'http://127.0.0.1:8000',
            '/static': 'http://127.0.0.1:8000',
            '/cameras': 'http://127.0.0.1:8000',
            '/video_feed': 'http://127.0.0.1:8000',
            '/add_camera': 'http://127.0.0.1:8000',
            '/set_main': 'http://127.0.0.1:8000',
        }
    }
})
