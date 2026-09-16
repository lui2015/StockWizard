import type { Quote, StockSprite } from '../data/types'
import { changePct } from './quotes'

export function levelOf(stock: StockSprite, quote: Quote) {
  const cap = quote.marketCap && quote.marketCap > 0 ? quote.marketCap : quote.floatCap
  if (cap && cap > 0) {
    const lv = Math.round((Math.log10(cap) - 8) * 15)
    return Math.max(1, Math.min(99, lv))
  }
  return { common: 10, uncommon: 20, rare: 32, legendary: 48 }[stock.rarity]
}

export function hpRatio(quote: Quote) {
  const pct = changePct(quote)
  return Math.max(0.18, Math.min(1, 0.72 + pct / 40))
}

export function catchPe(quote?: { pe?: number; peTtm?: number }) {
  const pe = quote?.peTtm ?? quote?.pe
  if (pe == null || pe <= 0) return 35
  return pe
}

export function catchRate(
  stock: StockSprite,
  seen: boolean,
  attempts: number,
  quote?: { pe?: number; peTtm?: number },
) {
  let rate = 0.64
  if (seen) rate += 0.08
  const pe = catchPe(quote)
  rate -= Math.min(0.42, Math.log10(Math.max(pe, 4) / 8) * 0.38)
  rate -= (stock.wildness / 100) * 0.06
  if (attempts > 0) rate -= 0.05 * attempts
  return Math.max(0.16, Math.min(0.82, rate))
}

export function trainerTitle(pct: number | null, captured = 0, total = 0) {
  if (total > 0 && captured >= total) return '图鉴完成者'
  if (pct == null) return '路过的观察员'
  if (pct >= 20) return '投资冠军'
  if (pct >= 10) return '冠军挑战者'
  if (pct >= 5) return '精英训练家'
  if (pct >= 2) return '正式训练家'
  return '新人训练家'
}

export function rarityLabel(rarity: StockSprite['rarity']) {
  return { common: '小盘', uncommon: '中盘', rare: '龙头', legendary: '权重' }[rarity]
}

export function advice(stock: StockSprite, quote: Quote) {
  const pct = changePct(quote)
  const pe = quote.peTtm ?? quote.pe
  if (!quote.live) return '估值还在接入，先看公司档案和实时行情。'
  if (pct > 4) return '今日涨得急，先记下市盈率和市净率，不宜只看涨幅。'
  if (pct < -4) return '今日回撤较多，对照市盈率和市净率看是杀估值还是杀业绩。'
  if (pe != null && pe > 50) return '市盈率偏高，增长预期已经打得很满。'
  if (pe != null && pe > 0 && pe < 12 && (quote.pb ?? 99) < 1.5) {
    return '估值看起来便宜，先确认盈利是不是在下滑。'
  }
  if ((quote.roe ?? 0) >= 15) return 'ROE 不低，适合对照同行看盈利能力还在不在。'
  if ((quote.dividendYield ?? 0) >= 4) return '股息率不低，可当收益型观察，也要看分红能不能持续。'
  if (stock.wildness >= 40) return '波动偏大，指标先记着，慎当主力仓位。'
  return '先看市盈率、市净率和 ROE，再决定要不要放进队伍慢慢跟踪。'
}
