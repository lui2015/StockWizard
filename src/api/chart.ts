import { klineSymbolOf, quoteIdOf } from '../utils/quoteId'
import type { StockSprite } from '../data/types'

export type ChartPeriod = 'minute' | 'day' | 'week' | 'month'

export interface Bar {
  time: string
  open: number
  close: number
  high: number
  low: number
  volume?: number
}

function num(v: unknown) {
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function parseTencent(json: { data?: Record<string, Record<string, unknown>> }, period: ChartPeriod) {
  const pack = json.data ? (Object.values(json.data)[0] as Record<string, unknown> | undefined) : undefined
  if (!pack) return []
  const keys =
    period === 'week'
      ? ['qfqweek', 'week']
      : period === 'month'
        ? ['qfqmonth', 'month']
        : ['qfqday', 'day']
  const rows = keys.flatMap((key) => (Array.isArray(pack[key]) ? (pack[key] as unknown[]) : []))
  return rows
    .map((row) => {
      const item = Array.isArray(row) ? row : []
      return {
        time: String(item[0] ?? ''),
        open: num(item[1]),
        close: num(item[2]),
        high: num(item[3]),
        low: num(item[4]),
        volume: num(item[5]) || undefined,
      }
    })
    .filter((bar) => bar.time && bar.close > 0)
}

function parseTrends(json: { data?: { trends?: string[] } }) {
  return (json.data?.trends ?? [])
    .map((line) => {
      const p = line.split(',')
      const price = num(p[1])
      const close = num(p[2]) || price
      return {
        time: p[0] ?? '',
        open: price || close,
        close,
        high: num(p[3]) || Math.max(price, close),
        low: num(p[4]) || Math.min(price, close),
      }
    })
    .filter((bar) => bar.time && bar.close > 0)
}

export async function fetchBars(symbol: string, period: ChartPeriod = 'day', days?: number) {
  const extra = days ? `&lmt=${days}` : ''
  const url = `/radar/bars?symbol=${encodeURIComponent(symbol)}&period=${period}${extra}`
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('K线中断')
  return parseTencent(await res.json(), period)
}

export async function fetchChart(stock: Pick<StockSprite, 'id' | 'code' | 'market'>, period: ChartPeriod) {
  if (period === 'minute') {
    const url = `/radar/trends?secid=${encodeURIComponent(quoteIdOf(stock))}&ndays=1&iscr=0&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58`
    const res = await fetch(url, { headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error('分时中断')
    return parseTrends(await res.json())
  }
  return fetchBars(klineSymbolOf(stock), period)
}
