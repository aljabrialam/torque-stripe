import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// The rule engine, dataset and gold set live one level up (shared with the Python reference engine).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { fs: { allow: ['..'] } },
  build: { chunkSizeWarningLimit: 2500 },
})
