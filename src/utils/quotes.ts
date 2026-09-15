import { STOCKS } from '../data/stocks'
import type { Quote } from '../data/types'

export function buildInitialQuotes(): Record<string, Quote> {
  const quotes: Record<string, Quote> = {}
  for (const stock of STOCKS) {
    quotes[stock.id] = {
      price: stock.basePrice,
      series: [stock.basePrice],
      open: stock.basePrice,
      live: false,
    }
  }
  return quotes
}

export function changePct(quote: Quote) {
  const base = quote.prevClose || quote.open
  if (!base) return 0
  return ((quote.price - base) / base) * 100
}

export function changeAmt(quote: Quote) {
  const base = quote.prevClose || quote.open
  return quote.price - (base || quote.price)
}

export function dayRange(quote: Quote) {
  return {
    high: quote.high ?? Math.max(...quote.series),
    low: quote.low ?? Math.min(...quote.series),
  }
}

export function formatPrice(price: number) {
  return price.toFixed(2)
}

export function formatTime(ts?: number) {
  if (!ts) return ''
  return new Date(ts).toLocaleTimeString('zh-CN', { hour12: false })
}

export function formatRatio(n?: number, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toFixed(digits)
}

export function formatMoney(n?: number) {
  if (n == null || n <= 0) return '—'
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}万亿`
  if (n >= 1e8) return `${(n / 1e8).toFixed(2)}亿`
  if (n >= 1e4) return `${(n / 1e4).toFixed(2)}万`
  return n.toFixed(0)
}

export function formatPercent(n?: number, digits = 2) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(digits)}%`
}

export function pricePercentile(price: number, history: number[]) {
  const pts = history.filter((n) => n > 0 && Number.isFinite(n))
  if (!pts.length || !(price > 0)) return null
  const below = pts.filter((n) => n < price).length
  return (below / pts.length) * 100
}

export function percentileNote(name: string, pct: number | null, sample: number) {
  if (pct == null || sample < 5) return '历史价格还在接入，分位稍后再看。'
  const n = Math.round(pct)
  if (pct >= 85) return `${name}现价处在近${sample}日高位，高于约 ${n}% 的历史收盘价。`
  if (pct >= 65) return `${name}现价偏高，超过近${sample}日约 ${n}% 的收盘价。`
  if (pct >= 40) return `${name}现价大致在近${sample}日中位，分位约 ${n}%。`
  if (pct >= 20) return `${name}现价偏低，只有约 ${n}% 的近${sample}日收盘价在它之下。`
  return `${name}现价处在近${sample}日低位附近，历史分位约 ${n}%。`
}
