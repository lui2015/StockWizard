import type { Holding, Quote } from '../data/types'

export function positionOf(holding: Holding | undefined, quote: Pick<Quote, 'price'>) {
  if (!holding || holding.qty <= 0 || holding.cost <= 0) return null
  const market = quote.price * holding.qty
  const cost = holding.cost * holding.qty
  return {
    qty: holding.qty,
    costPrice: holding.cost,
    cost,
    market,
    pnl: market - cost,
    pct: ((quote.price - holding.cost) / holding.cost) * 100,
  }
}

export function formatSigned(n: number, digits = 2) {
  const body = Math.abs(n).toFixed(digits)
  if (n > 0) return `+${body}`
  if (n < 0) return `-${body}`
  return body
}

export function bookOf(
  ids: string[],
  holdings: Record<string, Holding>,
  quotes: Record<string, Pick<Quote, 'price' | 'prevClose' | 'open'>>,
  fallbackPrice: (id: string) => number,
) {
  let cost = 0
  let market = 0
  let dayPnl = 0
  let yest = 0
  let win = 0
  let lose = 0
  let count = 0
  let topId = ''
  let topMarket = 0
  for (const id of ids) {
    const quote = quotes[id]
    const price = quote?.price && quote.price > 0 ? quote.price : fallbackPrice(id)
    const pos = positionOf(holdings[id], { price })
    if (!pos) continue
    count += 1
    cost += pos.cost
    market += pos.market
    if (pos.pnl > 0) win += 1
    else if (pos.pnl < 0) lose += 1
    if (pos.market > topMarket) {
      topMarket = pos.market
      topId = id
    }
    const base = quote?.prevClose || quote?.open
    if (base && base > 0) {
      dayPnl += (price - base) * pos.qty
      yest += base * pos.qty
    }
  }
  return {
    count,
    cost,
    market,
    pnl: market - cost,
    pct: cost > 0 ? ((market - cost) / cost) * 100 : null,
    dayPnl,
    dayPct: yest > 0 ? (dayPnl / yest) * 100 : null,
    win,
    lose,
    topId,
    topWeight: market > 0 && topId ? (topMarket / market) * 100 : null,
  }
}
