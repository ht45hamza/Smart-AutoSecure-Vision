import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        // Build directly into Django's static files
        outDir: '../static/dist',
        emptyOutDir: true,
        manifest: true,
        rollupOptions: {
            input: {
                main: './src/main.jsx',
            },
            output: {
                entryFileNames: `assets/[name].js`,
                chunkFileNames: `assets/[name].js`,
                assetFileNames: `assets/[name].[ext]`
            }
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
