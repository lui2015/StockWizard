import { useEffect, useState } from 'react'
import { fetchBars } from '../api/chart'
import { fetchMarketTape, TAPE_BARS, type TapeGroup, type TapeIndex } from '../api/eastmoney'
import { formatSigned } from '../utils/holding'
import { formatPrice, pricePercentile } from '../utils/quotes'
import { IndexDetail } from './IndexDetail'

const GROUPS: { id: TapeGroup; label: string }[] = [
  { id: 'CN', label: 'A股' },
  { id: 'HK', label: '港股' },
  { id: 'US', label: '美股' },
]

export function MarketTape() {
  const [rows, setRows] = useState<TapeIndex[]>([])
  const [closes, setCloses] = useState<Record<string, number[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState<TapeIndex | null>(null)

  useEffect(() => {
    let alive = true
    const pull = async () => {
      try {
        const next = await fetchMarketTape()
        if (!alive) return
        setRows(next)
        setError(next.length ? '' : '大盘指数还没刷出来，稍后再看。')
      } catch {
        if (alive) setError('大盘连不上行情源。确认本地服务已启动后再试。')
      } finally {
        if (alive) setLoading(false)
      }
    }
    void pull()
    const t = window.setInterval(() => {
      void pull()
    }, 12000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])

  useEffect(() => {
    let alive = true
    void Promise.all(
      Object.entries(TAPE_BARS).map(async ([id, symbol]) => {
        try {
          const bars = await fetchBars(symbol, 'day', 500)
          return [id, bars.map((bar) => bar.close).filter((n) => n > 0)] as const
        } catch {
          return [id, []] as const
        }
      }),
    ).then((pairs) => {
      if (alive) setCloses(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="radar tape">
      {error ? <p className="empty">{error}</p> : null}
      {loading && !rows.length ? <p className="empty">正在读取各大市场天气……</p> : null}
      {detail ? (
        <IndexDetail index={detail} onClose={() => setDetail(null)} />
      ) : (
        GROUPS.map((group) => {
          const list = rows.filter((row) => row.group === group.id)
          if (!list.length) return null
          return (
            <section key={group.id} className="tape-group">
              <h3>{group.label}</h3>
              <ol className="dex-list tape-list">
                {list.map((row) => {
                  const rank = pricePercentile(row.price, closes[row.id] ?? [])
                  return (
                    <li key={row.id}>
                      <button className="tape-row" onClick={() => setDetail(row)}>
                        <span className="dex-name">
                          <b>{row.name}</b>
                          <small>{row.id.split('.')[1]}</small>
                        </span>
                        <div className="rank-row">
                          <div className="hp-bar mini">
                            <i
                              style={{ width: `${rank ?? 0}%` }}
                              className={rank == null ? '' : rank >= 70 ? 'ok' : rank <= 30 ? 'low' : 'mid'}
                            />
                          </div>
                          <small>{rank == null ? '分位 —' : `${Math.round(rank)}%`}</small>
                        </div>
                        <strong className={row.pct >= 0 ? 'up' : 'down'}>{formatPrice(row.price)}</strong>
                        <em className={row.pct >= 0 ? 'up' : 'down'}>
                          {formatSigned(row.change)}
                          <small>{formatSigned(row.pct)}%</small>
                        </em>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </section>
          )
        })
      )}
    </div>
  )
}
