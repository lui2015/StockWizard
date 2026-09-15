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

function attachRadar(server: ViteDevServer | PreviewServer) {
  server.middlewares.use(async (req, res, next) => {
    const path = req.url?.split('?')[0] ?? ''
    if (path === '/radar/bars' && req.method === 'GET') {
      const u = new URL(req.url ?? '', 'http://local')
      const symbol = u.searchParams.get('symbol') ?? ''
      const period = u.searchParams.get('period') ?? 'day'
      const lmt = period === 'day' ? 100 : period === 'week' ? 72 : 48
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
    configureServer: attachRadar,
    configurePreviewServer: attachRadar,
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
