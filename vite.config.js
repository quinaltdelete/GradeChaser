import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, 'client'),          
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true
  },
  plugins: [react()]
})
