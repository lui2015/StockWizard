import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import express from 'express'
import { createRadarMiddleware, createReportsMiddleware } from './handlers.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')

const DIST = path.join(ROOT, 'dist')
const DATA_DIR = process.env.DATA_DIR ? path.resolve(ROOT, process.env.DATA_DIR) : path.join(ROOT, 'data')
const BASE = (process.env.BASE_PATH ?? '/StockWizard').replace(/\/+$/, '') || '/'
const PORT = Number(process.env.PORT || 3280)
const HOST = process.env.HOST || '0.0.0.0'

const sub = (route) => (BASE === '/' ? route : `${BASE}${route}`)

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.error('[stock-wizard] 未找到构建产物 dist/index.html，请先执行 npm run build')
  process.exit(1)
}

const app = express()
app.disable('x-powered-by')
app.set('trust proxy', true)

app.get(sub('/healthz'), (_req, res) => {
  res.json({ ok: true, service: 'stock-wizard', base: BASE, pid: process.pid })
})

app.use(BASE, createRadarMiddleware())
app.use(BASE, createReportsMiddleware(path.join(DATA_DIR, 'reports')))

app.use(
  sub('/'),
  express.static(DIST, {
    index: 'index.html',
    setHeaders(res, filePath) {
      if (filePath.endsWith('index.html')) res.setHeader('Cache-Control', 'no-cache')
    },
  }),
)

app.get(BASE, (_req, res) => res.redirect(302, sub('/')))
app.get(sub('/*'), (_req, res) => res.sendFile(path.join(DIST, 'index.html')))

app.listen(PORT, HOST, () => {
  console.log(`[stock-wizard] listening on http://${HOST}:${PORT}${sub('/')} (data: ${DATA_DIR})`)
})
