import { api } from './base'

export interface MarketHit {
  id: string
  code: string
  name: string
  pinyin: string
  market: 'CN' | 'HK'
  board: string
  quoteId: string
  price?: number
  pct?: number
}

export type RadarMarket = 'all' | 'CN' | 'HK' | 'SH' | 'SZ' | 'CYB' | 'KCB'

export const RADAR_BOARDS = [
  { id: 'all', label: '全部', fs: '' },
  { id: 'ai', label: '人工智能', fs: 'b:BK0800' },
  { id: 'robot', label: '人形机器人', fs: 'b:BK1184' },
  { id: 'compute', label: '算力', fs: 'b:BK1134' },
  { id: 'chip', label: '国产芯片', fs: 'b:BK0891' },
  { id: 'nev', label: '新能源车', fs: 'b:BK0900' },
  { id: 'solar', label: '光伏', fs: 'b:BK0588' },
  { id: 'battery', label: '锂电池', fs: 'b:BK0574' },
  { id: 'huawei', label: '华为概念', fs: 'b:BK0854' },
  { id: 'lowalt', label: '低空经济', fs: 'b:BK1166' },
  { id: 'drug', label: '创新药', fs: 'b:BK1106' },
  { id: 'drive', label: '智能驾驶', fs: 'b:BK0802' },
] as const

export type RadarBoard = (typeof RADAR_BOARDS)[number]['id']

interface EmSuggest {
  Code?: string
  Name?: string
  PinYin?: string
  SecurityTypeName?: string
  MktNum?: string
  QuoteID?: string
  Classify?: string
}

const A_BOARDS = new Set(['沪A', '深A', '京A'])
const SKIP_NAME = /购|沽|涡轮|窝轮|期货|指数|板块/

export function isCnOrHk(hit: EmSuggest) {
  const board = hit.SecurityTypeName ?? ''
  const name = hit.Name ?? ''
  if (SKIP_NAME.test(name)) return false
  if (A_BOARDS.has(board)) return true
  return board === '港股'
}

export async function searchStocks(keyword: string): Promise<MarketHit[]> {
  const q = keyword.trim()
  if (!q) return []
  const url = api(`/radar/search?input=${encodeURIComponent(q)}&type=14&count=20`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('雷达信号中断')
  const text = await res.text()
  const json = JSON.parse(text) as { QuotationCodeTable?: { Data?: EmSuggest[] } }
  if (!json.QuotationCodeTable) throw new Error('雷达信号中断')
  const rows = json.QuotationCodeTable?.Data ?? []
  const seen = new Set<string>()
  const hits: MarketHit[] = []
  for (const row of rows) {
    if (!isCnOrHk(row) || !row.Code || !row.Name || !row.QuoteID) continue
    if (seen.has(row.QuoteID)) continue
    seen.add(row.QuoteID)
    hits.push({
      id: `em-${row.QuoteID}`,
      code: row.Code,
      name: row.Name,
      pinyin: row.PinYin ?? '',
      market: row.SecurityTypeName === '港股' ? 'HK' : 'CN',
      board: row.SecurityTypeName ?? '',
      quoteId: row.QuoteID,
    })
  }
  return hits
}

const MARKET_FS: Record<RadarMarket, string> = {
  all: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23,m:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2',
  CN: 'm:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23',
  HK: 'm:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2',
  SH: 'm:1+t:2,m:1+t:23',
  SZ: 'm:0+t:6,m:0+t:80',
  CYB: 'm:0+t:80',
  KCB: 'm:1+t:23',
}

const SECTOR_FS: Record<string, string> = {
  finance: 'b:BK0475,b:BK0473,b:BK0474',
  consumer: 'b:BK0438,b:BK0482',
  healthcare: 'b:BK0465',
  energy: 'b:BK0464,b:BK0437,b:BK0428',
  property: 'b:BK0451',
  industrials: 'b:BK1205,b:BK0481,b:BK1204',
  tech: 'b:BK0448,b:BK0447',
  internet: 'b:BK0486,b:BK0447',
  cyclical: 'b:BK0478,b:BK0479',
}

function boardOf(mkt: string): { market: 'CN' | 'HK'; board: string } {
  if (mkt === '116' || mkt === '128') return { market: 'HK', board: '港股' }
  if (mkt === '90') return { market: 'CN', board: '京A' }
  if (mkt === '1') return { market: 'CN', board: '沪A' }
  return { market: 'CN', board: '深A' }
}

function skipScreen(name: string, code: string) {
  if (SKIP_NAME.test(name) || /ST|退|B股|Ｂ/.test(name)) return true
  if (/^(200|900)/.test(code)) return true
  return false
}

function hitFromClist(row: Record<string, unknown>): MarketHit | null {
  const code = String(row.f12 ?? '')
  const mkt = String(row.f13 ?? '')
  const name = String(row.f14 ?? '')
  if (!code || !mkt || !name || skipScreen(name, code)) return null
  const { market, board } = boardOf(mkt)
  const quoteId = `${mkt}.${code}`
  const price = num(row.f2)
  const pct = ratio(row.f3)
  return {
    id: `em-${quoteId}`,
    code,
    name,
    pinyin: '',
    market,
    board,
    quoteId,
    price: price > 0 ? price : undefined,
    pct,
  }
}

export function radarKind(hit: MarketHit): Exclude<RadarMarket, 'all' | 'CN'> {
  if (hit.market === 'HK' || hit.board === '港股') return 'HK'
  const code = hit.code.replace(/\D/g, '')
  if (code.startsWith('688')) return 'KCB'
  if (code.startsWith('300') || code.startsWith('301')) return 'CYB'
  if (code.startsWith('6') || hit.board === '沪A') return 'SH'
  return 'SZ'
}

export function matchMarket(hit: MarketHit, market: RadarMarket) {
  if (market === 'all') return true
  if (market === 'CN') return hit.market === 'CN'
  if (market === 'HK') return hit.market === 'HK'
  const kind = radarKind(hit)
  if (market === 'SH') return kind === 'SH' || kind === 'KCB'
  if (market === 'SZ') return kind === 'SZ' || kind === 'CYB'
  return kind === market
}

function matchKeyword(hit: MarketHit, keyword: string) {
  const q = keyword.trim().toLowerCase()
  if (!q) return true
  return (
    hit.name.toLowerCase().includes(q) ||
    hit.code.toLowerCase().includes(q) ||
    hit.pinyin.toLowerCase().includes(q)
  )
}

async function fetchClist(fs: string, limit: number): Promise<MarketHit[]> {
  const params = new URLSearchParams({
    pn: '1',
    pz: String(limit),
    po: '1',
    np: '1',
    fltt: '2',
    invt: '2',
    fid: 'f3',
    fs,
    fields: 'f12,f13,f14,f2,f3',
  })
  const res = await fetch(api(`/radar/clist?${params}`), { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('雷达信号中断')
  const json = (await res.json()) as {
    data?: { diff?: Record<string, Record<string, unknown>> | Array<Record<string, unknown>> }
  }
  const raw = json.data?.diff
  const rows = Array.isArray(raw) ? raw : raw ? Object.values(raw) : []
  const seen = new Set<string>()
  const hits: MarketHit[] = []
  for (const row of rows) {
    const hit = hitFromClist(row)
    if (!hit || seen.has(hit.quoteId)) continue
    seen.add(hit.quoteId)
    hits.push(hit)
  }
  return hits
}

export async function screenStocks(opts: {
  market: RadarMarket
  sector: string
  board: RadarBoard
  keyword?: string
}): Promise<MarketHit[]> {
  const boardFs = RADAR_BOARDS.find((item) => item.id === opts.board)?.fs
  const useSector = !boardFs && opts.sector !== 'all' && opts.market !== 'HK' && SECTOR_FS[opts.sector]
  const fs = boardFs || (useSector ? SECTOR_FS[opts.sector] : MARKET_FS[opts.market])
  const hits = await fetchClist(fs, opts.keyword ? 100 : 40)
  return hits
    .filter((hit) => matchMarket(hit, opts.market) && matchKeyword(hit, opts.keyword ?? ''))
    .slice(0, 30)
}

export interface LiveQuote {
  price: number
  open: number
  high: number
  low: number
  prevClose: number
  name: string
  series: number[]
  pe?: number
  peTtm?: number
  peStatic?: number
  peDynamic?: number
  pb?: number
  marketCap?: number
  floatCap?: number
  turnover?: number
  volumeRatio?: number
  amplitude?: number
  amount?: number
  volume?: number
  industry?: string
  eps?: number
  netProfit?: number
  revenue?: number
  roe?: number
  netMargin?: number
  grossMargin?: number
  dividendYield?: number
}

function num(v: unknown, fallback = 0) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : fallback
}

function ratio(v: unknown): number | undefined {
  if (v === '-' || v === '' || v == null) return undefined
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n) || Math.abs(n) > 1e6) return undefined
  return n
}

function cap(v: unknown): number | undefined {
  const n = num(v)
  return n > 0 ? n : undefined
}

function pickFund(row: Record<string, unknown>): Partial<LiveQuote> {
  const peDynamic = ratio(row.f162 ?? row.f9)
  const peStatic = ratio(row.f163)
  const peTtm = ratio(row.f164)
  const pe = peTtm ?? peDynamic ?? peStatic
  return {
    pe,
    peTtm,
    peStatic,
    peDynamic,
    pb: ratio(row.f167 ?? row.f23),
    marketCap: cap(row.f116 ?? row.f20),
    floatCap: cap(row.f117 ?? row.f21),
    turnover: ratio(row.f168 ?? row.f8),
    volumeRatio: ratio(row.f50 ?? row.f10),
    amplitude: ratio(row.f171 ?? row.f7),
    amount: cap(row.f48 ?? row.f6),
    volume: cap(row.f47 ?? row.f5),
    industry: row.f127 ? String(row.f127) : undefined,
    eps: ratio(row.f108),
    netProfit: cap(row.f109),
    revenue: cap(row.f183),
    roe: ratio(row.f173) || undefined,
    netMargin: ratio(row.f187) || undefined,
    grossMargin: ratio(row.f186) || undefined,
    dividendYield: ratio(row.f197) || undefined,
  }
}

function parseSeries(lines: string[], priceIndex = 1) {
  return lines
    .map((line) => num(line.split(',')[priceIndex]))
    .filter((n) => n > 0)
}

export async function fetchLiveQuote(quoteId: string): Promise<LiveQuote | null> {
  const quoteUrl = api(`/radar/quote?secid=${encodeURIComponent(quoteId)}&invt=2&fltt=2&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f108,f109,f116,f117,f127,f162,f163,f164,f167,f168,f169,f170,f171,f173,f183,f186,f187,f197`)
  const trendsUrl = api(`/radar/trends?secid=${encodeURIComponent(quoteId)}&ndays=1&iscr=0&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58`)
  const klineUrl = api(`/radar/kline?secid=${encodeURIComponent(quoteId)}&klt=101&fqt=1&lmt=20&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55`)

  const [quoteRes, trendsRes, klineRes] = await Promise.allSettled([
    fetch(quoteUrl, { headers: { Accept: 'application/json' } }),
    fetch(trendsUrl, { headers: { Accept: 'application/json' } }),
    fetch(klineUrl, { headers: { Accept: 'application/json' } }),
  ])

  let price = 0
  let open = 0
  let high = 0
  let low = 0
  let prevClose = 0
  let name = ''
  let series: number[] = []
  let fund: Partial<LiveQuote> = {}

  if (quoteRes.status === 'fulfilled' && quoteRes.value.ok) {
    const json = (await quoteRes.value.json()) as { data?: Record<string, unknown> }
    const data = json.data
    if (data) {
      price = num(data.f43)
      high = num(data.f44)
      low = num(data.f45)
      open = num(data.f46)
      prevClose = num(data.f60)
      name = String(data.f58 ?? '')
      fund = pickFund(data)
    }
  }

  if (trendsRes.status === 'fulfilled' && trendsRes.value.ok) {
    const json = (await trendsRes.value.json()) as { data?: { trends?: string[] } }
    series = parseSeries(json.data?.trends ?? [], 1)
  }

  if (series.length < 2 && klineRes.status === 'fulfilled' && klineRes.value.ok) {
    const json = (await klineRes.value.json()) as { data?: { klines?: string[] } }
    series = parseSeries(json.data?.klines ?? [], 2)
  }

  if (price <= 0) {
    const batch = await fetchBatchQuotes([quoteId]).catch(() => ({} as Record<string, LiveQuote>))
    const snapped = batch[quoteId] || batch[quoteId.split('.').pop() ?? '']
    if (snapped) {
      price = snapped.price
      open = open || snapped.open
      high = high || snapped.high
      low = low || snapped.low
      prevClose = prevClose || snapped.prevClose
      name = name || snapped.name
      fund = {
        pe: fund.pe ?? snapped.pe,
        peTtm: fund.peTtm ?? snapped.peTtm,
        peStatic: fund.peStatic ?? snapped.peStatic,
        peDynamic: fund.peDynamic ?? snapped.peDynamic,
        pb: fund.pb ?? snapped.pb,
        marketCap: fund.marketCap ?? snapped.marketCap,
        floatCap: fund.floatCap ?? snapped.floatCap,
        turnover: fund.turnover ?? snapped.turnover,
        volumeRatio: fund.volumeRatio ?? snapped.volumeRatio,
        amplitude: fund.amplitude ?? snapped.amplitude,
        amount: fund.amount ?? snapped.amount,
        volume: fund.volume ?? snapped.volume,
        industry: fund.industry ?? snapped.industry,
        eps: fund.eps ?? snapped.eps,
        netProfit: fund.netProfit ?? snapped.netProfit,
        revenue: fund.revenue ?? snapped.revenue,
        roe: fund.roe ?? snapped.roe,
        netMargin: fund.netMargin ?? snapped.netMargin,
        grossMargin: fund.grossMargin ?? snapped.grossMargin,
        dividendYield: fund.dividendYield ?? snapped.dividendYield,
      }
      if (series.length < 2) series = snapped.series
    }
  }

  if (price <= 0 && series.length) price = series[series.length - 1]
  if (open <= 0) open = prevClose || series[0] || price
  if (price <= 0) return null
  if (series.length < 2) {
    series = Array.from({ length: 20 }, (_, i) =>
      Number((open + ((price - open) * i) / 19).toFixed(2)),
    )
  }
  return {
    price,
    open,
    high: high || Math.max(...series),
    low: low || Math.min(...series),
    prevClose: prevClose || open,
    name,
    series,
    ...fund,
  }
}

export type TapeGroup = 'CN' | 'HK' | 'US'

export interface TapeIndex {
  id: string
  group: TapeGroup
  name: string
  price: number
  pct: number
  change: number
}

const TAPE_LIST: { id: string; group: TapeGroup; name: string; bar: string }[] = [
  { id: '1.000001', group: 'CN', name: '上证指数', bar: 'sh000001' },
  { id: '0.399001', group: 'CN', name: '深证成指', bar: 'sz399001' },
  { id: '1.000300', group: 'CN', name: '沪深300', bar: 'sh000300' },
  { id: '0.399006', group: 'CN', name: '创业板指', bar: 'sz399006' },
  { id: '1.000688', group: 'CN', name: '科创50', bar: 'sh000688' },
  { id: '1.000016', group: 'CN', name: '上证50', bar: 'sh000016' },
  { id: '100.HSI', group: 'HK', name: '恒生指数', bar: 'hkHSI' },
  { id: '100.HSCEI', group: 'HK', name: '恒生国企', bar: 'hkHSCEI' },
  { id: '124.HSTECH', group: 'HK', name: '恒生科技', bar: 'hkHSTECH' },
  { id: '100.DJIA', group: 'US', name: '道琼斯', bar: 'usDJI' },
  { id: '100.NDX', group: 'US', name: '纳斯达克', bar: 'usIXIC' },
  { id: '100.SPX', group: 'US', name: '标普500', bar: 'usINX' },
]

export const TAPE_BARS = Object.fromEntries(TAPE_LIST.map((item) => [item.id, item.bar]))

export async function fetchMarketTape(): Promise<TapeIndex[]> {
  const url = api(`/radar/ulist?fltt=2&invt=2&fields=f12,f13,f14,f2,f3,f4,f18&secids=${encodeURIComponent(
    TAPE_LIST.map((item) => item.id).join(','),
  )}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('大盘信号中断')
  const json = (await res.json()) as {
    data?: { diff?: Record<string, Record<string, unknown>> | Array<Record<string, unknown>> }
  }
  const raw = json.data?.diff
  const rows = Array.isArray(raw) ? raw : raw ? Object.values(raw) : []
  const byId = new Map<string, Record<string, unknown>>()
  for (const row of rows) {
    const id = `${row.f13}.${row.f12}`
    byId.set(id, row)
    byId.set(String(row.f12 ?? ''), row)
  }
  return TAPE_LIST.map((item) => {
    const row = byId.get(item.id) ?? byId.get(item.id.split('.')[1] ?? '')
    const price = num(row?.f2)
    const pct = ratio(row?.f3)
    const change = ratio(row?.f4)
    const prev = num(row?.f18)
    return {
      ...item,
      price,
      pct: pct ?? (prev > 0 && price > 0 ? ((price - prev) / prev) * 100 : 0),
      change: change ?? (price && prev ? price - prev : 0),
    }
  }).filter((item) => item.price > 0)
}

export async function fetchBatchQuotes(quoteIds: string[]): Promise<Record<string, LiveQuote>> {
  const ids = quoteIds.filter(Boolean)
  if (!ids.length) return {}
  const url = api(`/radar/ulist?fltt=2&invt=2&fields=f12,f13,f14,f2,f3,f5,f6,f7,f8,f9,f10,f15,f16,f17,f18,f20,f21,f23&secids=${encodeURIComponent(ids.join(','))}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) return {}
  const json = (await res.json()) as {
    data?: { diff?: Record<string, Record<string, unknown>> | Array<Record<string, unknown>> }
  }
  const raw = json.data?.diff
  const rows = Array.isArray(raw) ? raw : raw ? Object.values(raw) : []
  const out: Record<string, LiveQuote> = {}
  for (const row of rows) {
    const market = String(row.f13 ?? '')
    const code = String(row.f12 ?? '')
    const quoteId = `${market}.${code}`
    const price = num(row.f2)
    if (price <= 0) continue
    const open = num(row.f17) || price
    const prevClose = num(row.f18) || open
    const live = {
      price,
      open,
      high: num(row.f15) || price,
      low: num(row.f16) || price,
      prevClose,
      name: String(row.f14 ?? ''),
      series: [open, price],
      ...pickFund(row),
    }
    out[quoteId] = live
    out[code] = live
  }
  return out
}
