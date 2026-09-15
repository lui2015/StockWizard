import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin, type PreviewServer, type ViteDevServer } from 'vite'
import react from '@vitejs/plugin-react'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const ROUTES: Record<string, string[]> = {
  '/radar/search': ['https://searchapi.eastmoney.com/api/suggest/get'],
  '/radar/quote': [
    'https://push2delay.eastmoney.com/api/qt/stock/get',
    'https://push2.eastmoney.com/api/qt/stock/get',
  ],
  '/radar/kline': [
    'https://push2.eastmoney.com/api/qt/stock/kline/get',
    'https://push2delay.eastmoney.com/api/qt/stock/kline/get',
    'https://push2his.eastmoney.com/api/qt/stock/kline/get',
  ],
  '/radar/trends': ['https://push2.eastmoney.com/api/qt/stock/trends2/get'],
  '/radar/ulist': ['https://push2.eastmoney.com/api/qt/ulist.np/get'],
  '/radar/clist': [
    'https://push2delay.eastmoney.com/api/qt/clist/get',
    'https://push2.eastmoney.com/api/qt/clist/get',
    'https://79.push2.eastmoney.com/api/qt/clist/get',
  ],
}

const UPSTREAM_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/json',
  Referer: 'https://quote.eastmoney.com/',
}

async function fetchUpstream(targets: string[], query: string) {
  let lastError: unknown
  for (const target of targets) {
    try {
      const upstream = await fetch(`${target}${query}`, { headers: UPSTREAM_HEADERS })
      if (upstream.ok) return upstream
      lastError = new Error(`${target} ${upstream.status}`)
    } catch (error) {
      lastError = error
    }
  }
  throw lastError ?? new Error('no radar upstream')
}

const REPORT_DIR = path.resolve(process.cwd(), 'data/reports')
const REPORT_MAX = 1_500_000

interface ReportMeta {
  id: string
  title: string
  createdAt: number
  source: 'upload' | 'api'
  bytes: number
}

function ensureReportDir() {
  fs.mkdirSync(REPORT_DIR, { recursive: true })
}

function manifestFile() {
  return path.join(REPORT_DIR, 'manifest.json')
}

function readManifest(): ReportMeta[] {
  ensureReportDir()
  if (!fs.existsSync(manifestFile())) return []
  try {
    const rows = JSON.parse(fs.readFileSync(manifestFile(), 'utf8')) as ReportMeta[]
    return Array.isArray(rows) ? rows : []
  } catch {
    return []
  }
}

function writeManifest(rows: ReportMeta[]) {
  ensureReportDir()
  fs.writeFileSync(manifestFile(), JSON.stringify(rows, null, 2))
}

function titleFromHtml(html: string, fallback: string) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  const heading = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim()
  return (title || heading || fallback).slice(0, 40)
}

function readBody(req: { on: (ev: string, fn: (c?: Buffer) => void) => void }) {
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      size += buf.length
      if (size > REPORT_MAX) {
        reject(new Error('报告太大，请控制在 1.5MB 内'))
        return
      }
      chunks.push(buf)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function sendJson(res: { statusCode: number; setHeader: (k: string, v: string) => void; end: (b: string) => void }, status: number, body: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(body))
}

function attachReports(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (req, res, next) => {
    const url = req.url?.split('?')[0] ?? ''
    if (!url.startsWith('/api/reports')) {
      next()
      return
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    const rest = url.slice('/api/reports'.length).replace(/^\//, '')
    const [id, extra] = rest.split('/')

    try {
      if (req.method === 'GET' && !id) {
        sendJson(res, 200, { ok: true, reports: readManifest() })
        return
      }
      if (req.method === 'GET' && id && extra === 'raw') {
        const file = path.join(REPORT_DIR, `${id}.html`)
        if (!fs.existsSync(file)) {
          sendJson(res, 404, { ok: false, error: '报告不存在' })
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        res.end(fs.readFileSync(file, 'utf8'))
        return
      }
      if (req.method === 'GET' && id) {
        const meta = readManifest().find((row) => row.id === id)
        const file = path.join(REPORT_DIR, `${id}.html`)
        if (!meta || !fs.existsSync(file)) {
          sendJson(res, 404, { ok: false, error: '报告不存在' })
          return
        }
        sendJson(res, 200, { ok: true, ...meta, html: fs.readFileSync(file, 'utf8') })
        return
      }
      if (req.method === 'POST' && !id) {
        const raw = await readBody(req)
        let title = ''
        let html = raw
        let source: 'upload' | 'api' = 'api'
        const type = String((req as { headers?: { 'content-type'?: string } }).headers?.['content-type'] ?? '')
        if (type.includes('application/json')) {
          const body = JSON.parse(raw) as { title?: string; html?: string; source?: 'upload' | 'api' }
          html = String(body.html ?? '')
          title = String(body.title ?? '')
          source = body.source === 'upload' ? 'upload' : 'api'
        }
        if (!/<html/i.test(html)) {
          sendJson(res, 400, { ok: false, error: 'html 字段需要完整 HTML 文档' })
          return
        }
        const nextId = `rpt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
        const meta: ReportMeta = {
          id: nextId,
          title: titleFromHtml(html, title || '未命名报告'),
          createdAt: Date.now(),
          source,
          bytes: Buffer.byteLength(html),
        }
        ensureReportDir()
        fs.writeFileSync(path.join(REPORT_DIR, `${nextId}.html`), html)
        writeManifest([meta, ...readManifest()])
        sendJson(res, 200, { ok: true, id: meta.id, title: meta.title })
        return
      }
      if (req.method === 'DELETE' && id && !extra) {
        const rows = readManifest().filter((row) => row.id !== id)
        writeManifest(rows)
        const file = path.join(REPORT_DIR, `${id}.html`)
        if (fs.existsSync(file)) fs.unlinkSync(file)
        sendJson(res, 200, { ok: true })
        return
      }
      sendJson(res, 404, { ok: false, error: '接口不存在' })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : '报告接口失败' })
    }
  })
}

function attachRadar(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (req, res, next) => {
    const path = req.url?.split('?')[0] ?? ''
    if (path === '/radar/bars' && req.method === 'GET') {
      const u = new URL(req.url ?? '', 'http://local')
      const symbol = u.searchParams.get('symbol') ?? ''
      const period = u.searchParams.get('period') ?? 'day'
      const asked = Number(u.searchParams.get('lmt'))
      const fallback = period === 'day' ? 100 : period === 'week' ? 72 : 48
      const lmt = Number.isFinite(asked) ? Math.min(800, Math.max(20, Math.round(asked))) : fallback
      const host = symbol.startsWith('us')
        ? 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get'
        : 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
      try {
        const upstream = await fetch(
          `${host}?param=${encodeURIComponent(`${symbol},${period},,,${lmt},qfq`)}`,
          { headers: { ...UPSTREAM_HEADERS, Referer: 'https://gu.qq.com/' } },
        )
        const body = await upstream.text()
        res.statusCode = upstream.status
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(body)
      } catch (error) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'kline upstream failed', detail: String(error) }))
      }
      return
    }
    const targets = ROUTES[path]
    if (!targets || req.method !== 'GET') {
      next()
      return
    }
    const query = req.url?.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''
    try {
      const upstream = await fetchUpstream(targets, query)
      const body = await upstream.text()
      res.statusCode = upstream.status
      res.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json; charset=utf-8')
      res.end(body)
    } catch (error) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'radar upstream failed', detail: String(error) }))
    }
  })
}

function eastmoneyRadar(): Plugin {
  return {
    name: 'eastmoney-radar',
    configureServer(server) {
      attachReports(server)
      attachRadar(server)
    },
    configurePreviewServer(server) {
      attachReports(server)
      attachRadar(server)
    },
  }
}

export default defineConfig({
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
