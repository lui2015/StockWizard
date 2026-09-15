import fs from 'node:fs'
import path from 'node:path'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const ROUTES = {
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

const REPORT_MAX = 1_500_000
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/

async function fetchUpstream(targets, query) {
  let lastError
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

/** 东财行情代理：/radar/* 与 /radar/bars */
export function createRadarMiddleware() {
  return async function radarMiddleware(req, res, next) {
    const url = req.url?.split('?')[0] ?? ''

    if (url === '/radar/bars' && req.method === 'GET') {
      const query = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1))
      const symbol = query.get('symbol') ?? ''
      const period = query.get('period') ?? 'day'
      const asked = Number(query.get('lmt'))
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

    const targets = ROUTES[url]
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
      res.setHeader('Cache-Control', 'public, max-age=10')
      res.end(body)
    } catch (error) {
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'radar upstream failed', detail: String(error) }))
    }
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
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

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.end(JSON.stringify(body))
}

function titleFromHtml(html, fallback) {
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim()
  const heading = html.match(/<h1[^>]*>([^<]+)<\/h1>/i)?.[1]?.trim()
  return (title || heading || fallback).slice(0, 40)
}

/** 分析报告存储：/api/reports */
export function createReportsMiddleware(reportDir) {
  const dir = path.resolve(reportDir)
  const manifestFile = () => path.join(dir, 'manifest.json')

  function ensureDir() {
    fs.mkdirSync(dir, { recursive: true })
  }

  function readManifest() {
    ensureDir()
    if (!fs.existsSync(manifestFile())) return []
    try {
      const rows = JSON.parse(fs.readFileSync(manifestFile(), 'utf8'))
      return Array.isArray(rows) ? rows : []
    } catch {
      return []
    }
  }

  function writeManifest(rows) {
    ensureDir()
    fs.writeFileSync(manifestFile(), JSON.stringify(rows, null, 2))
  }

  return async function reportsMiddleware(req, res, next) {
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
    const [rawId, extra] = rest.split('/')
    const id = rawId ?? ''

    try {
      if (req.method === 'GET' && !id) {
        sendJson(res, 200, { ok: true, reports: readManifest() })
        return
      }
      // 报告 id 只允许安全字符，避免路径穿越读到任意文件
      if (id && !ID_PATTERN.test(id)) {
        sendJson(res, 400, { ok: false, error: '报告 ID 不合法' })
        return
      }
      if (req.method === 'GET' && extra === 'raw') {
        const file = path.join(dir, `${id}.html`)
        if (!fs.existsSync(file)) {
          sendJson(res, 404, { ok: false, error: '报告不存在' })
          return
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'text/html; charset=utf-8')
        // 报告是用户/模型上传的 HTML，禁用脚本执行，避免污染宿主页面
        res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data: https: blob:; font-src data:")
        res.end(fs.readFileSync(file, 'utf8'))
        return
      }
      if (req.method === 'GET' && !extra) {
        const meta = readManifest().find((row) => row.id === id)
        const file = path.join(dir, `${id}.html`)
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
        let source = 'api'
        const type = String(req.headers?.['content-type'] ?? '')
        if (type.includes('application/json')) {
          const body = JSON.parse(raw)
          html = String(body.html ?? '')
          title = String(body.title ?? '')
          source = body.source === 'upload' ? 'upload' : 'api'
        }
        if (!/<html/i.test(html)) {
          sendJson(res, 400, { ok: false, error: 'html 字段需要完整 HTML 文档' })
          return
        }
        const nextId = `rpt-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`
        const meta = {
          id: nextId,
          title: titleFromHtml(html, title || '未命名报告'),
          createdAt: Date.now(),
          source,
          bytes: Buffer.byteLength(html),
        }
        ensureDir()
        fs.writeFileSync(path.join(dir, `${nextId}.html`), html)
        writeManifest([meta, ...readManifest()])
        sendJson(res, 200, { ok: true, id: meta.id, title: meta.title })
        return
      }
      if (req.method === 'DELETE' && !extra) {
        writeManifest(readManifest().filter((row) => row.id !== id))
        const file = path.join(dir, `${id}.html`)
        if (fs.existsSync(file)) fs.unlinkSync(file)
        sendJson(res, 200, { ok: true })
        return
      }
      sendJson(res, 404, { ok: false, error: '接口不存在' })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : '报告接口失败' })
    }
  }
}
