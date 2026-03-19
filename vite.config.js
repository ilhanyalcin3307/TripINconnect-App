import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173, // Electron’un bekleyeceği port
    strictPort: true, // Port doluysa hata versin
  },
  base: './',
  build: {
    outDir: 'dist',
  },
})