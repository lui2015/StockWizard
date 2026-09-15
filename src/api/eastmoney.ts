export interface MarketHit {
  id: string
  code: string
  name: string
  pinyin: string
  market: 'CN' | 'HK'
  board: string
  quoteId: string
}

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
  const url = `/radar/search?input=${encodeURIComponent(q)}&type=14&count=20`
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
  const quoteUrl = `/radar/quote?secid=${encodeURIComponent(quoteId)}&invt=2&fltt=2&fields=f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f108,f109,f116,f117,f127,f162,f163,f164,f167,f168,f169,f170,f171,f173,f183,f186,f187,f197`
  const trendsUrl = `/radar/trends?secid=${encodeURIComponent(quoteId)}&ndays=1&iscr=0&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58`
  const klineUrl = `/radar/kline?secid=${encodeURIComponent(quoteId)}&klt=101&fqt=1&lmt=20&end=20500101&fields1=f1,f2,f3,f4,f5,f6&fields2=f51,f52,f53,f54,f55`

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

export async function fetchBatchQuotes(quoteIds: string[]): Promise<Record<string, LiveQuote>> {
  const ids = quoteIds.filter(Boolean)
  if (!ids.length) return {}
  const url = `/radar/ulist?fltt=2&invt=2&fields=f12,f13,f14,f2,f3,f5,f6,f7,f8,f9,f10,f15,f16,f17,f18,f20,f21,f23&secids=${encodeURIComponent(ids.join(','))}`
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
