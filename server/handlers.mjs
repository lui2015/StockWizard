import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

const ROUTES = {
  '/radar/quote': [
    'https://push2delay.eastmoney.com/api/qt/stock/get',
    'https://push2.eastmoney.com/api/qt/stock/get',
  ],
  '/radar/kline': [
    'https://push2delay.eastmoney.com/api/qt/stock/kline/get',
    'https://push2.eastmoney.com/api/qt/stock/kline/get',
    'https://push2his.eastmoney.com/api/qt/stock/kline/get',
  ],
  '/radar/trends': [
    'https://push2delay.eastmoney.com/api/qt/stock/trends2/get',
    'https://push2.eastmoney.com/api/qt/stock/trends2/get',
  ],
  '/radar/ulist': [
    'https://push2delay.eastmoney.com/api/qt/ulist.np/get',
    'https://push2.eastmoney.com/api/qt/ulist.np/get',
  ],
  '/radar/clist': [
    'https://push2delay.eastmoney.com/api/qt/clist/get',
    'https://push2.eastmoney.com/api/qt/clist/get',
    'https://79.push2.eastmoney.com/api/qt/clist/get',
  ],
  '/radar/eva': ['https://danjuanfunds.com/djapi/index_eva/dj'],
  '/radar/fin': ['https://datacenter.eastmoney.com/securities/api/data/get'],
  '/radar/finv1': ['https://datacenter.eastmoney.com/securities/api/data/v1/get'],
}

const UPSTREAM_HEADERS = {
  'User-Agent': UA,
  Accept: 'application/json',
  Referer: 'https://quote.eastmoney.com/',
}

// ===== 腾讯行情适配层 =====
// 东财 push2 系列行情接口在本机被 WAF 封禁（API 路径连接被秒断），
// 改用腾讯行情（qt.gtimg.cn / web.ifzq.gtimg.cn）作为主数据源，
// 并把响应转换成东财字段格式（f43/f58/f116...），前端无需任何改动。

const TX_HEADERS = { 'User-Agent': UA, Referer: 'https://gu.qq.com/' }

/** 东财 secid（1.600519 / 116.00700 / 105.AAPL / 100.HSI）→ 腾讯行情代码 */
function txCodeOf(secid) {
  const dot = String(secid ?? '').indexOf('.')
  const mkt = dot >= 0 ? String(secid).slice(0, dot) : ''
  const code = dot >= 0 ? String(secid).slice(dot + 1) : ''
  if (!code) return ''
  if (mkt === '1') return `sh${code}`
  if (mkt === '0') return `sz${code}`
  if (mkt === '90') return `bj${code}`
  if (mkt === '116' || mkt === '128') return `hk${code.replace(/\.HK$/i, '').padStart(5, '0')}`
  if (mkt === '105' || mkt === '106' || mkt === '107') return `us${code}`
  if (mkt === '100' || mkt === '124') return `hk${code}`
  return ''
}

function txNum(f, i) {
  const n = Number(f?.[i])
  return Number.isFinite(n) ? n : 0
}

function parseTxPayload(text) {
  const map = new Map()
  for (const m of text.matchAll(/v_([A-Za-z0-9_.]+)="([^"]*)"/g)) {
    map.set(m[1], m[2].split('~'))
  }
  return map
}

/**
 * 腾讯 qt 行字段 → 东财 ulist 行（f2 价格 / f3 涨跌% / f14 名称 / f116 市值...）
 * 腾讯字段（~ 分隔）：3 现价 4 昨收 5 今开 31 涨跌 32 涨跌% 33 高 34 低
 * 36 成交量 37 成交额 38 换手 39 PE(TTM) 43 振幅 44 流通市值(亿) 45 总市值(亿) 46/47 PB
 * A股专属：49 量比 52 PE动 53 PE静 64 股息率
 */
function txToEmRow(secid, f) {
  if (!Array.isArray(f) || f.length < 47) return null
  const price = txNum(f, 3)
  if (!(price > 0)) return null
  const dot = String(secid).indexOf('.')
  const mkt = String(secid).slice(0, dot)
  const rawCode = String(secid).slice(dot + 1)
  const txCode = txCodeOf(secid)
  const kind = /^us/.test(txCode) ? 'us' : /^hk/.test(txCode) ? 'hk' : 'cn'
  const isA = kind === 'cn'
  const isIndex = f.includes('ZS')

  const amountRaw = txNum(f, 37)
  // A股与港股指数的成交额单位是万元，其余是元
  const amount = isA || (kind === 'hk' && isIndex) ? amountRaw * 1e4 : amountRaw
  const capYi = txNum(f, 45)
  const floatYi = txNum(f, 44)
  const marketCap = !isIndex && capYi > 0 ? capYi * 1e8 : undefined
  const floatCap = !isIndex && floatYi > 0 ? floatYi * 1e8 : undefined
  const dividend = isA && txNum(f, 64) > 0 ? txNum(f, 64) : '-'
  const pb = isA ? txNum(f, 46) : kind === 'hk' ? txNum(f, 47) : '-'
  // 港股行情不带换手率：成交量 / 总股本 换算
  const hkShares = kind === 'hk' && !isIndex && capYi > 0 ? (capYi * 1e8) / price : 0
  const hkTurnover =
    hkShares > 0 && txNum(f, 36) > 0
      ? Math.round((txNum(f, 36) / hkShares) * 10000) / 100
      : '-'

  return {
    f12: rawCode,
    f13: mkt,
    f14: f[1] ?? '',
    f2: price,
    f3: txNum(f, 32),
    f4: txNum(f, 31),
    f5: txNum(f, 36),
    f6: amount,
    f7: txNum(f, 43),
    f8: isA ? txNum(f, 38) || '-' : kind === 'hk' && !isIndex ? hkTurnover : '-',
    f9: isA ? txNum(f, 52) : '-',
    f10: isA ? txNum(f, 49) : '-',
    f15: txNum(f, 33),
    f16: txNum(f, 34),
    f17: txNum(f, 5),
    f18: txNum(f, 4),
    f20: marketCap,
    f21: floatCap,
    f23: pb,
    f84: !isIndex && marketCap ? Math.round(marketCap / price) : '-',
    f133: dividend,
    f163: isA ? txNum(f, 53) : '-',
    f164: txNum(f, 39),
    f188: '-',
    f197: dividend,
  }
}

function emQuoteDataFromRow(row) {
  return {
    f43: row.f2,
    f44: row.f15,
    f45: row.f16,
    f46: row.f17,
    f47: row.f5,
    f48: row.f6,
    f50: row.f10,
    f57: row.f12,
    f58: row.f14,
    f60: row.f18,
    f84: row.f84,
    f116: row.f20,
    f117: row.f21,
    f127: '',
    f162: row.f9,
    f163: row.f163,
    f164: row.f164,
    f167: row.f23,
    f168: row.f8,
    f169: row.f4,
    f170: row.f3,
    f171: row.f7,
    f173: '-',
    f183: '-',
    f186: '-',
    f187: '-',
    f197: row.f197,
  }
}

async function fetchTxQuotes(txList) {
  const res = await fetch(`https://qt.gtimg.cn/q=${encodeURIComponent(txList.join(','))}`, {
    headers: TX_HEADERS,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`qt.gtimg.cn ${res.status}`)
  return parseTxPayload(new TextDecoder('gbk').decode(await res.arrayBuffer()))
}

function lookupTx(map, code) {
  return map.get(code) ?? map.get(code.replace(/\..*$/, ''))
}

// ===== F10 财务指标补全 =====
// 腾讯行情没有 ROE/净利润/营收/利润率等指标，东财 push2 又被封，
// 从东财 datacenter（与 /radar/fin 同源，可用）拉 F10 主要指标补齐，缓存 1 小时。
const f10Cache = new Map() // secid -> { ts, data }
const F10_TTL = 60 * 60 * 1000

async function fetchF10Fundamentals(secid, price = 0) {
  const cached = f10Cache.get(secid)
  if (cached && Date.now() - cached.ts < F10_TTL) return cached.data
  const dot = String(secid ?? '').indexOf('.')
  const mkt = String(secid ?? '').slice(0, dot)
  const code = String(secid ?? '').slice(dot + 1)
  if (!['1', '0', '90', '116', '128'].includes(mkt) || !code) return null
  let data
  if (mkt === '116' || mkt === '128') {
    // 港股：HKF10 主要指标（多取几期，找最近年报算市盈静，TTM EPS 算市盈动）
    const qs = new URLSearchParams({
      reportName: 'RPT_HKF10_FN_MAININDICATOR',
      columns: 'ALL',
      filter: `(SECUCODE="${code}.HK")`,
      pageNumber: '1',
      pageSize: '8',
      sortColumns: 'REPORT_DATE',
      sortTypes: '-1',
      source: 'F10',
      client: 'PC',
    })
    const res = await fetch(
      `https://datacenter.eastmoney.com/securities/api/data/v1/get?${qs}`,
      {
        headers: {
          'User-Agent': UA,
          Accept: 'application/json',
          Referer: 'https://emweb.securities.eastmoney.com/',
        },
        signal: AbortSignal.timeout(8000),
      },
    )
    if (!res.ok) throw new Error(`f10hk ${res.status}`)
    const json = await res.json()
    const list = json?.result?.data ?? []
    const row = list[0]
    if (!row) throw new Error('f10hk empty')
    const numOrDash = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : '-')
    const peFrom = (eps) =>
      typeof eps === 'number' && eps > 0 && price > 0 ? Math.round((price / eps) * 100) / 100 : '-'
    const annual = list.find((r) => String(r?.REPORT_DATE ?? '').includes('-12-31'))
    data = {
      f108: numOrDash(row.BASIC_EPS),
      f109: numOrDash(row.HOLDER_PROFIT),
      f183: numOrDash(row.OPERATE_INCOME),
      f173: numOrDash(row.ROE_YEARLY),
      f186: numOrDash(row.GROSS_PROFIT_RATIO),
      f187: numOrDash(row.NET_PROFIT_RATIO),
      f197: numOrDash(row.DIVIDEND_RATE),
      // 港股行情源无静态/动态 PE：市盈静=现价/年报EPS，市盈动=现价/TTM EPS
      f163: peFrom(annual?.BASIC_EPS),
      f162: peFrom(row.EPS_TTM),
    }
  } else {
    // A股（沪深京）：F10 主要指标
    const secu = `${code}.${mkt === '1' ? 'SH' : mkt === '0' ? 'SZ' : 'BJ'}`
    const qs = new URLSearchParams({
      type: 'RPT_F10_FINANCE_MAINFINADATA',
      sty: 'APP_F10_MAINFINADATA',
      filter: `(SECUCODE="${secu}")`,
      p: '1',
      ps: '1',
      sr: '-1',
      st: 'REPORT_DATE',
      source: 'HSF10',
      client: 'PC',
    })
    const res = await fetch(`https://datacenter.eastmoney.com/securities/api/data/get?${qs}`, {
      headers: {
        'User-Agent': UA,
        Accept: 'application/json',
        Referer: 'https://emweb.securities.eastmoney.com/',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`f10 ${res.status}`)
    const json = await res.json()
    const row = json?.result?.data?.[0]
    if (!row) throw new Error('f10 empty')
    const numOrDash = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : '-')
    data = {
      // 东财 push2 字段号：f108 每股收益 f109 净利润 f183 营收 f173 ROE f186 毛利率 f187 净利率
      f108: numOrDash(row.EPSJB),
      f109: numOrDash(row.PARENTNETPROFIT),
      f183: numOrDash(row.TOTALOPERATEREVE),
      f173: numOrDash(row.ROEJQ),
      f186: numOrDash(row.XSMLL),
      f187: numOrDash(row.XSJLL),
    }
  }
  f10Cache.set(secid, { ts: Date.now(), data })
  return data
}

// 量比：今日成交量 / 近 5 日平均成交量（腾讯行情不带港股量比，用日 K 换算，缓存 10 分钟）
const vrCache = new Map() // secid -> { ts, data }
const VR_TTL = 10 * 60 * 1000

async function fetchVolumeRatio(secid) {
  const cached = vrCache.get(secid)
  if (cached && Date.now() - cached.ts < VR_TTL) return cached.data
  const code = txCodeOf(secid)
  if (!code) throw new Error('bad secid')
  const host = code.startsWith('us')
    ? 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get'
    : 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
  const res = await fetch(`${host}?param=${encodeURIComponent(`${code},day,,,6,qfq`)}`, {
    headers: TX_HEADERS,
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`vr ${res.status}`)
  const json = await res.json()
  const pack = json?.data?.[code] ?? {}
  const rows = (pack.qfqday ?? pack.day ?? []).filter((r) => Array.isArray(r))
  const vols = rows.map((r) => Number(r[5]) || 0).filter((v) => v > 0)
  if (vols.length < 6) throw new Error('vr not enough')
  const today = vols[vols.length - 1]
  const avg5 = vols.slice(-6, -1).reduce((a, b) => a + b, 0) / 5
  if (!(avg5 > 0)) throw new Error('vr zero')
  const data = Math.round((today / avg5) * 100) / 100
  vrCache.set(secid, { ts: Date.now(), data })
  return data
}

// 个股资讯：东财 np-listapi 开放接口代理（缓存 10 分钟）
const newsCache = new Map() // secid -> { ts, data }
const NEWS_TTL = 10 * 60 * 1000

async function fetchStockNews(secid) {
  const cached = newsCache.get(secid)
  if (cached && Date.now() - cached.ts < NEWS_TTL) return cached.data
  const qs = new URLSearchParams({
    client: 'web',
    mTypeAndCode: secid,
    pageSize: '30',
    type: '0',
    req_trace: String(Date.now()),
  })
  const res = await fetch(`https://np-listapi.eastmoney.com/comm/web/getListInfo?${qs}`, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
      Referer: 'https://quote.eastmoney.com/',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`news ${res.status}`)
  const json = await res.json()
  const data = (json?.data?.list ?? [])
    .map((r) => ({
      code: String(r.Art_Code ?? ''),
      title: String(r.Art_Title ?? '').trim(),
      time: String(r.Art_ShowTime ?? ''),
      url: String(r.Art_Url ?? r.Art_OriginUrl ?? ''),
    }))
    .filter((r) => r.title && r.url)
  newsCache.set(secid, { ts: Date.now(), data })
  return data
}

/** 批量行情 → 东财 ulist 格式 */
async function tencentUlist(secids) {
  const ids = String(secids ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const txList = ids.map(txCodeOf).filter(Boolean)
  if (!txList.length) return { data: { diff: [] } }
  const map = await fetchTxQuotes(txList)
  const rows = []
  for (const secid of ids) {
    const f = lookupTx(map, txCodeOf(secid))
    if (!f) continue
    const row = txToEmRow(secid, f)
    if (row) rows.push(row)
  }
  return { data: { diff: rows } }
}

/** 分时 → 东财 trends2 格式（"date hh:mm,price,avg,vol,..."） */
async function tencentTrends(secid) {
  const code = txCodeOf(secid)
  if (!code) throw new Error('bad secid')
  const res = await fetch(
    `https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${encodeURIComponent(code)}`,
    { headers: TX_HEADERS, signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`minute/query ${res.status}`)
  const json = await res.json()
  const pack = json?.data?.[code]
  const lines = pack?.data?.data ?? []
  const dateRaw = String(pack?.data?.date ?? '')
  const date = dateRaw.length === 8
    ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
    : ''
  const prevClose = txNum(pack?.qt?.[code], 4)
  const trends = []
  for (const line of lines) {
    const p = String(line).trim().split(/\s+/)
    const hm = p[0] ?? ''
    const price = Number(p[1])
    if (hm.length < 4 || !(price > 0)) continue
    const time = date ? `${date} ${hm.slice(0, 2)}:${hm.slice(2, 4)}` : hm
    trends.push(`${time},${price},${price},0,0`)
  }
  return { data: { trends, preClose: prevClose } }
}

/** 日 K → 东财 klines 格式（"date,open,close,high,low,vol"） */
async function tencentKline(secid, askedLmt) {
  const code = txCodeOf(secid)
  if (!code) throw new Error('bad secid')
  const n = Math.min(120, Math.max(5, Number.isFinite(askedLmt) ? askedLmt : 20))
  const host = code.startsWith('us')
    ? 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get'
    : 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
  const res = await fetch(
    `${host}?param=${encodeURIComponent(`${code},day,,,${n},qfq`)}`,
    { headers: TX_HEADERS, signal: AbortSignal.timeout(8000) },
  )
  if (!res.ok) throw new Error(`fqkline ${res.status}`)
  const json = await res.json()
  const pack = json?.data?.[code] ?? {}
  const rows = pack.qfqday ?? pack.day ?? []
  const klines = rows
    .filter((r) => Array.isArray(r) && r.length >= 5)
    .map((r) => `${r[0]},${r[1]},${r[2]},${r[3]},${r[4]},${Number(r[5]) || 0}`)
  return { data: { klines } }
}

const REPORT_MAX = 1_500_000
const SAVE_MAX = 4_000_000
const ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/
const NAME_PATTERN = /^[A-Za-z0-9_.-]{3,24}$/

async function fetchUpstream(targets, query) {
  let lastError
  for (const target of targets) {
    try {
      const upstream = await fetch(`${target}${query}`, {
        headers: UPSTREAM_HEADERS,
        signal: AbortSignal.timeout(8000),
      })
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

      // 五日分时：腾讯按天返回分钟线
      if (period === 'day5') {
        try {
          const upstream = await fetch(
            `https://web.ifzq.gtimg.cn/appstock/app/day/query?code=${encodeURIComponent(symbol)}`,
            {
              headers: { ...UPSTREAM_HEADERS, Referer: 'https://gu.qq.com/' },
              signal: AbortSignal.timeout(8000),
            },
          )
          const body = await upstream.text()
          res.statusCode = upstream.status
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'public, max-age=60')
          res.end(body)
        } catch (error) {
          res.statusCode = 502
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ error: 'kline upstream failed', detail: String(error) }))
        }
        return
      }

      const asked = Number(query.get('lmt'))
      const fallback = period === 'day' ? 100 : period === 'week' ? 72 : 48
      const lmt = Number.isFinite(asked) ? Math.min(1300, Math.max(20, Math.round(asked))) : fallback
      const host = symbol.startsWith('us')
        ? 'https://web.ifzq.gtimg.cn/appstock/app/usfqkline/get'
        : 'https://web.ifzq.gtimg.cn/appstock/app/fqkline/get'
      try {
        const upstream = await fetch(
          `${host}?param=${encodeURIComponent(`${symbol},${period},,,${lmt},qfq`)}`,
          {
            headers: { ...UPSTREAM_HEADERS, Referer: 'https://gu.qq.com/' },
            signal: AbortSignal.timeout(8000),
          },
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

    // 股票联想：东财 searchapi 对非浏览器 TLS 指纹返回垃圾响应，改用腾讯 smartbox
    if (url === '/radar/search' && req.method === 'GET') {
      const query = new URLSearchParams(req.url.slice(req.url.indexOf('?') + 1))
      const keyword = (query.get('input') ?? '').trim()
      try {
        if (!keyword) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.end(JSON.stringify({ QuotationCodeTable: { Data: [] } }))
          return
        }
        const upstream = await fetch(
          `https://smartbox.gtimg.cn/s3/?v=2&t=all&q=${encodeURIComponent(keyword)}`,
          {
            headers: { ...UPSTREAM_HEADERS, Referer: 'https://gu.qq.com/' },
            signal: AbortSignal.timeout(8000),
          },
        )
        const text = new TextDecoder('gbk').decode(await upstream.arrayBuffer())
        const matched = text.match(/v_hint="(.*)"/)
        // 腾讯接口的中文是字面 \uXXXX 转义，需要还原
        const unescape = (s) =>
          s.replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
        const rows = []
        if (matched) {
          const seen = new Set()
          for (const item of matched[1].split('^')) {
            const f = item.split('~')
            const market = (f[0] ?? '').toLowerCase()
            const code = f[1] ?? ''
            const name = unescape(f[2] ?? '')
            const pinyin = unescape(f[3] ?? '')
            const kind = (f[4] ?? '').toUpperCase()
            if (!/^(sh|sz|bj|hk)$/.test(market)) continue
            if (kind !== 'GP' && kind !== 'GP-A') continue
            if (/购|沽|涡轮|窝轮|期货|指数|板块|wr$/i.test(name)) continue
            const quoteId =
              market === 'hk' ? `116.${code}` : market === 'sh' ? `1.${code}` : `0.${code}`
            if (seen.has(quoteId)) continue
            seen.add(quoteId)
            rows.push({
              Code: code,
              Name: name,
              PinYin: pinyin,
              SecurityTypeName:
                market === 'hk' ? '港股' : market === 'sh' ? '沪A' : market === 'sz' ? '深A' : '京A',
              QuoteID: quoteId,
            })
            if (rows.length >= 20) break
          }
        }
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.setHeader('Cache-Control', 'public, max-age=10')
        res.end(JSON.stringify({ QuotationCodeTable: { Data: rows } }))
      } catch (error) {
        res.statusCode = 502
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ error: 'radar search failed', detail: String(error) }))
      }
      return
    }

    // 东财 push2 行情在本机被封禁：quote/ulist/trends/kline 优先走腾讯适配层，
    // 腾讯不可用时再回落到东财透传
    if (
      req.method === 'GET' &&
      (url === '/radar/quote' ||
        url === '/radar/ulist' ||
        url === '/radar/trends' ||
        url === '/radar/kline' ||
        url === '/radar/news')
    ) {
      const query = new URLSearchParams(
        req.url?.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '',
      )
      try {
        let payload = null
        if (url === '/radar/quote') {
          const secid = query.get('secid') ?? ''
          const list = await tencentUlist(secid)
          const row = list.data.diff[0]
          if (row) {
            let data = emQuoteDataFromRow(row)
            // F10 财务指标补全（ROE/净利润/营收/利润率/每股收益），失败不阻塞
            const f10 = await fetchF10Fundamentals(secid, row.f2).catch(() => null)
            if (f10) data = { ...data, ...f10 }
            // 量比缺失（港股）时用日 K 换算，失败不阻塞
            if (data.f50 === '-' || data.f50 == null) {
              const vr = await fetchVolumeRatio(secid).catch(() => null)
              if (vr != null) data.f50 = vr
            }
            payload = { data }
          } else {
            payload = null
          }
        } else if (url === '/radar/ulist') {
          payload = await tencentUlist(query.get('secids') ?? '')
        } else if (url === '/radar/trends') {
          payload = await tencentTrends(query.get('secid') ?? '')
        } else if (url === '/radar/news') {
          const news = await fetchStockNews(query.get('secid') ?? '').catch(() => null)
          payload = news ? { data: { list: news } } : null
        } else {
          payload = await tencentKline(query.get('secid') ?? '', Number(query.get('lmt')))
        }
        if (payload) {
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json; charset=utf-8')
          res.setHeader('Cache-Control', 'public, max-age=10')
          res.end(JSON.stringify(payload))
          return
        }
      } catch {
        // 腾讯失败，继续走下面的东财透传
      }
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
      if (url === '/radar/clist') {
        // 榜单源不可用时返回空列表兜底，避免雷达/筛选页直接报错
        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json; charset=utf-8')
        res.end(JSON.stringify({ data: { diff: [] } }))
        return
      }
      res.statusCode = 502
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      res.end(JSON.stringify({ error: 'radar upstream failed', detail: String(error) }))
    }
  }
}

function readBody(req, max = REPORT_MAX) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk))
      size += buf.length
      if (size > max) {
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

function hashPassword(password, salt) {
  return crypto.scryptSync(password, salt, 32).toString('hex')
}

/** 账号体系：注册/登录 + 云端存档 /api/auth/*、/api/save */
export function createAuthMiddleware(authDir) {
  const dir = path.resolve(authDir)
  const usersFile = () => path.join(dir, 'users.json')
  const savesDir = () => path.join(dir, 'saves')
  const saveFile = (id) => path.join(savesDir(), `${id}.json`)

  function ensure() {
    fs.mkdirSync(dir, { recursive: true })
    fs.mkdirSync(savesDir(), { recursive: true })
  }

  function readUsers() {
    ensure()
    if (!fs.existsSync(usersFile())) return []
    try {
      const rows = JSON.parse(fs.readFileSync(usersFile(), 'utf8'))
      return Array.isArray(rows) ? rows : []
    } catch {
      return []
    }
  }

  function writeUsers(rows) {
    ensure()
    fs.writeFileSync(usersFile(), JSON.stringify(rows, null, 2))
  }

  function publicUser(row) {
    return { id: row.id, username: row.username, createdAt: row.createdAt }
  }

  function bearer(req) {
    const raw = String(req.headers?.authorization ?? '')
    return raw.startsWith('Bearer ') ? raw.slice(7).trim() : ''
  }

  function userByToken(req) {
    const token = bearer(req)
    if (!token) return null
    return readUsers().find((row) => row.token === token) ?? null
  }

  return async function authMiddleware(req, res, next) {
    const url = req.url?.split('?')[0] ?? ''
    if (!url.startsWith('/api/auth') && url !== '/api/save') {
      next()
      return
    }
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    if (req.method === 'OPTIONS') {
      res.statusCode = 204
      res.end()
      return
    }

    try {
      if (req.method === 'POST' && (url === '/api/auth/register' || url === '/api/auth/login')) {
        const raw = await readBody(req)
        let username = ''
        let password = ''
        try {
          const body = JSON.parse(raw)
          username = String(body.username ?? '').trim()
          password = String(body.password ?? '')
        } catch {
          sendJson(res, 400, { ok: false, error: '请求格式不对' })
          return
        }
        if (!NAME_PATTERN.test(username)) {
          sendJson(res, 400, { ok: false, error: '用户名需 3-24 位，可用字母、数字、_ . -' })
          return
        }
        if (password.length < 6 || password.length > 64) {
          sendJson(res, 400, { ok: false, error: '密码需 6-64 位' })
          return
        }

        const users = readUsers()
        if (url === '/api/auth/register') {
          if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
            sendJson(res, 409, { ok: false, error: '这个用户名已经被用了' })
            return
          }
          const salt = crypto.randomBytes(16).toString('hex')
          const row = {
            id: `u-${Date.now().toString(36)}-${crypto.randomBytes(3).toString('hex')}`,
            username,
            salt,
            hash: hashPassword(password, salt),
            token: crypto.randomBytes(24).toString('hex'),
            createdAt: Date.now(),
          }
          users.push(row)
          writeUsers(users)
          sendJson(res, 200, { ok: true, token: row.token, user: publicUser(row) })
          return
        }

        const row = users.find((u) => u.username.toLowerCase() === username.toLowerCase())
        if (!row || row.hash !== hashPassword(password, row.salt)) {
          sendJson(res, 401, { ok: false, error: '用户名或密码不对' })
          return
        }
        row.token = crypto.randomBytes(24).toString('hex')
        writeUsers(users)
        sendJson(res, 200, { ok: true, token: row.token, user: publicUser(row) })
        return
      }

      if (req.method === 'GET' && url === '/api/auth/me') {
        const row = userByToken(req)
        if (!row) {
          sendJson(res, 401, { ok: false, error: '未登录' })
          return
        }
        sendJson(res, 200, { ok: true, user: publicUser(row) })
        return
      }

      if (req.method === 'POST' && url === '/api/auth/logout') {
        const token = bearer(req)
        const users = readUsers()
        const row = users.find((u) => u.token === token)
        if (row) {
          row.token = ''
          writeUsers(users)
        }
        sendJson(res, 200, { ok: true })
        return
      }

      if (url === '/api/save') {
        const row = userByToken(req)
        if (!row) {
          sendJson(res, 401, { ok: false, error: '未登录' })
          return
        }
        if (req.method === 'GET') {
          ensure()
          if (!fs.existsSync(saveFile(row.id))) {
            sendJson(res, 200, { ok: true, save: null })
            return
          }
          try {
            sendJson(res, 200, { ok: true, save: JSON.parse(fs.readFileSync(saveFile(row.id), 'utf8')) })
          } catch {
            sendJson(res, 200, { ok: true, save: null })
          }
          return
        }
        if (req.method === 'PUT') {
          const raw = await readBody(req, SAVE_MAX)
          const body = JSON.parse(raw)
          if (!body || typeof body !== 'object' || !body.save || typeof body.save !== 'object') {
            sendJson(res, 400, { ok: false, error: '存档格式不对' })
            return
          }
          ensure()
          fs.writeFileSync(saveFile(row.id), JSON.stringify(body.save))
          sendJson(res, 200, { ok: true, updatedAt: Date.now() })
          return
        }
        if (req.method === 'DELETE') {
          if (fs.existsSync(saveFile(row.id))) fs.unlinkSync(saveFile(row.id))
          sendJson(res, 200, { ok: true })
          return
        }
      }

      sendJson(res, 404, { ok: false, error: '接口不存在' })
    } catch (error) {
      sendJson(res, 500, { ok: false, error: error instanceof Error ? error.message : '账号服务出错' })
    }
  }
}
