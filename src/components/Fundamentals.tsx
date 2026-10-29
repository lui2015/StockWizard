import type { Quote } from '../data/types'
import { changePct, formatMoney, formatPercent, formatPrice, formatRatio } from '../utils/quotes'

/** 图鉴页基本面指标：股价/估值/盈利/规模 一览（数据缺失显示 —） */
export function Fundamentals({ quote }: { quote: Quote }) {
  if (!quote.live) return null
  const pe = quote.peTtm ?? quote.pe
  const pct = changePct(quote)
  const items: { label: string; value: string }[] = [
    { label: '当前股价', value: `${formatPrice(quote.price)}（${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%）` },
    { label: '市盈率', value: pe && pe > 0 ? `${formatRatio(pe)} 倍` : '—' },
    { label: '市净率', value: quote.pb && quote.pb > 0 ? `${formatRatio(quote.pb)} 倍` : '—' },
    { label: '股息率', value: quote.dividendYield != null && quote.dividendYield > 0 ? formatPercent(quote.dividendYield) : '—' },
    { label: '毛利率', value: quote.grossMargin != null ? formatPercent(quote.grossMargin) : '—' },
    { label: '净利率', value: quote.netMargin != null ? formatPercent(quote.netMargin) : '—' },
    { label: '营业收入', value: quote.revenue && quote.revenue > 0 ? formatMoney(quote.revenue) : '—' },
    { label: '总市值', value: quote.marketCap && quote.marketCap > 0 ? formatMoney(quote.marketCap) : '—' },
  ]
  return (
    <ul className="fund-strip">
      {items.map((item) => (
        <li key={item.label}>
          <span>{item.label}</span>
          <b>{item.value}</b>
        </li>
      ))}
    </ul>
  )
}
