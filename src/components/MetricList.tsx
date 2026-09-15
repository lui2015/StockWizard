import type { Quote } from '../data/types'
import { formatMoney, formatPercent, formatRatio } from '../utils/quotes'

type Metric = { label: string; value: string }

const GROUPS: { title: string; items: (quote: Quote) => Metric[] }[] = [
  {
    title: '估值',
    items: (q) => [
      { label: '市盈TTM', value: formatRatio(q.peTtm ?? q.pe) },
      { label: '市盈静', value: formatRatio(q.peStatic) },
      { label: '市盈动', value: formatRatio(q.peDynamic) },
      { label: '市净率', value: formatRatio(q.pb) },
    ],
  },
  {
    title: '盈利',
    items: (q) => [
      { label: 'ROE', value: formatPercent(q.roe) },
      { label: '每股收益', value: formatRatio(q.eps) },
      { label: '净利润', value: formatMoney(q.netProfit) },
      { label: '营业收入', value: formatMoney(q.revenue) },
      { label: '净利率', value: formatPercent(q.netMargin) },
      { label: '毛利率', value: formatPercent(q.grossMargin) },
    ],
  },
  {
    title: '规模与回报',
    items: (q) => [
      { label: '总市值', value: formatMoney(q.marketCap) },
      { label: '流通市值', value: formatMoney(q.floatCap) },
      { label: '股息率', value: formatPercent(q.dividendYield) },
      { label: '行业', value: q.industry || '—' },
    ],
  },
  {
    title: '交易',
    items: (q) => [
      { label: '换手率', value: formatPercent(q.turnover) },
      { label: '成交额', value: formatMoney(q.amount) },
      { label: '量比', value: formatRatio(q.volumeRatio) },
      { label: '振幅', value: formatPercent(q.amplitude) },
    ],
  },
]

export function MetricList({ quote }: { quote: Quote }) {
  return (
    <div className="metric-board">
      {GROUPS.map((group) => (
        <section key={group.title} className="metric-group">
          <h3>{group.title}</h3>
          <ul className="metric-grid">
            {group.items(quote).map((row) => (
              <li key={row.label}>
                <span>{row.label}</span>
                <b>{row.value}</b>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
