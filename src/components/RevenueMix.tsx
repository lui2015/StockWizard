import { useEffect, useState } from 'react'
import { api } from '../api/base'
import { quoteIdOf } from '../utils/quoteId'
import { formatMoney } from '../utils/quotes'
import type { StockSprite } from '../data/types'

interface MixItem {
  name: string
  income: number
  ratio: number
}

interface MixData {
  reportDate: string
  typeLabel: string
  items: MixItem[]
}

/** 公司档案下方：营收构成（A股取东财 F10 主营构成，其余用图鉴业务板块） */
export function RevenueMix({ stock }: { stock: StockSprite }) {
  const [data, setData] = useState<MixData | null>(null)
  const [loading, setLoading] = useState(stock.market === 'CN')

  useEffect(() => {
    if (stock.market !== 'CN') return
    let alive = true
    setLoading(true)
    void fetch(api(`/radar/business?secid=${encodeURIComponent(quoteIdOf(stock))}`), {
      headers: { Accept: 'application/json' },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { data?: MixData } | null) => {
        if (!alive) return
        setData(json?.data?.items?.length ? json.data : null)
        setLoading(false)
      })
      .catch(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [stock.id, stock.code, stock.market])

  const sectors = stock.weightLabel
    .split(/[·、,，/]/)
    .map((s) => s.trim())
    .filter(Boolean)

  return (
    <section className="revenue-mix">
      <h3>
        营收构成
        {data ? (
          <small>
            {data.reportDate} · {data.typeLabel}
          </small>
        ) : null}
      </h3>
      {loading ? <p className="fine">正在读取财报主营构成…</p> : null}
      {data ? (
        <ul className="mix-list">
          {data.items.map((item) => (
            <li key={item.name}>
              <div className="mix-row">
                <b>{item.name}</b>
                <span>
                  {item.income > 0 ? formatMoney(item.income) : ''} {item.ratio.toFixed(1)}%
                </span>
              </div>
              <div className="mix-bar">
                <i style={{ width: `${Math.max(1, Math.min(100, item.ratio))}%` }} />
              </div>
            </li>
          ))}
        </ul>
      ) : !loading ? (
        <>
          <ul className="mix-tags">
            {sectors.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
          <p className="fine">主要业务板块（图鉴整理，非财报口径）。</p>
        </>
      ) : null}
    </section>
  )
}
