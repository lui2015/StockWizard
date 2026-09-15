import path from 'node:path'
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'
import { createRadarMiddleware, createReportsMiddleware } from './server/handlers.mjs'

function eastmoneyRadar(): Plugin {
  const reportDir = path.resolve(process.cwd(), 'data/reports')
  return {
    name: 'eastmoney-radar',
    configureServer(server: ViteDevServer | PreviewServer) {
      server.middlewares.use(createRadarMiddleware())
      server.middlewares.use(createReportsMiddleware(reportDir))
    },
    configurePreviewServer(server: ViteDevServer | PreviewServer) {
      server.middlewares.use(createRadarMiddleware())
      server.middlewares.use(createReportsMiddleware(reportDir))
    },
  }
}

export default defineConfig({
  base: process.env.VITE_BASE || '/',
  plugins: [react(), eastmoneyRadar()],
  server: {
    port: 5173,
    host: '127.0.0.1',
  },
  preview: {
    port: 5173,
    host: '127.0.0.1',
  },
})
