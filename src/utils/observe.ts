import type { Quote, StockSprite } from '../data/types'
import { changePct, dayRange, formatMoney, formatPrice, formatRatio } from './quotes'

function peLabel(quote?: Quote) {
  if (!quote) return '—'
  if (quote.peTtm != null) return `${formatRatio(quote.peTtm)}（TTM）`
  if (quote.peDynamic != null) return `${formatRatio(quote.peDynamic)}（动）`
  if (quote.peStatic != null) return `${formatRatio(quote.peStatic)}（静）`
  if (quote.pe != null) return formatRatio(quote.pe)
  return '—'
}

export function observeNotes(stock: StockSprite, quote?: Quote) {
  const pct = quote ? changePct(quote) : 0
  const range = quote ? dayRange(quote) : { high: 0, low: 0 }
  const signed = `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`
  const industry = quote?.industry || stock.category

  return [
    quote
      ? `观察① 现价 ${formatPrice(quote.price)}，今日 ${signed}。高 ${formatPrice(range.high)} / 低 ${formatPrice(range.low)}。${quote.live ? '实时' : '待刷新'}。再点看估值。`
      : `观察① ${stock.name} 行情还没锁稳。再点试试。`,
    `观察② 市盈率 ${peLabel(quote)}，市净率 ${formatRatio(quote?.pb)}。市盈率看贵贱，市净率看账面。再点看市值。`,
    `观察③ 总市值 ${formatMoney(quote?.marketCap)}，流通 ${formatMoney(quote?.floatCap)}，换手 ${formatRatio(quote?.turnover)}%。再点看成交。`,
    `观察④ 成交额 ${formatMoney(quote?.amount)}，量比 ${formatRatio(quote?.volumeRatio)}，振幅 ${formatRatio(quote?.amplitude)}%。再点看公司。`,
    `观察⑤ ${industry}。要点「${stock.ability}」：${stock.abilityDesc} 再点回到现价。`,
  ]
}
