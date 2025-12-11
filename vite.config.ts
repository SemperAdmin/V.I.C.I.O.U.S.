import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // Default to root path for local dev, use VITE_BASE_PATH env var for GitHub Pages
  const base = env.VITE_BASE_PATH || '/'
  return {
    base,
    plugins: [react()],
    server: {
      host: true,
      port: 5173
    },
    preview: {
      host: true,
      port: 5173
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
  }
})
