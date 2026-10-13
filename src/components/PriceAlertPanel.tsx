import { useState } from 'react'
import type { PriceAlert, Quote, StockSprite } from '../data/types'
import { formatPrice } from '../utils/quotes'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

/**
 * 观察页「买入/卖出提醒」：设置预期价格，实时行情到达后全局弹出提示。
 */
export function PriceAlertPanel({ stock, quote }: { stock: StockSprite; quote: Quote }) {
  const { save, addAlert, removeAlert, play } = useGame()
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [price, setPrice] = useState('')

  const alerts = save.alerts?.[stock.id] ?? []
  const cur = quote.price > 0 ? quote.price : 0

  const submit = () => {
    const target = Number(price)
    if (!Number.isFinite(target) || target <= 0) return
    addAlert(stock.id, side, target)
    play(sfx.select)
    setPrice('')
  }

  const statusOf = (a: PriceAlert) => {
    if (a.triggered) return '已触发'
    if (!(cur > 0)) return '等待行情'
    if (a.side === 'buy') return cur <= a.price ? '已到达' : `还差 ${formatPrice(a.price - cur)}`
    return cur >= a.price ? '已到达' : `还差 ${formatPrice(cur - a.price)}`
  }

  return (
    <section className="alert-panel">
      <h3>买入 / 卖出提醒</h3>
      <p className="fine">
        设置预期价格，实时行情到达时自动提示{alerts.length ? `（最多 6 条，已设 ${alerts.length} 条）` : ''}。
      </p>
      {quote.live ? (
        <div className="alert-form">
          <button
            type="button"
            className={side === 'buy' ? 'side-btn buy on' : 'side-btn buy'}
            onClick={() => setSide('buy')}
          >
            买入提醒
          </button>
          <button
            type="button"
            className={side === 'sell' ? 'side-btn sell on' : 'side-btn sell'}
            onClick={() => setSide('sell')}
          >
            卖出提醒
          </button>
          <input
            className="alert-price"
            inputMode="decimal"
            placeholder={`预期价（现价 ${formatPrice(cur)}）`}
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit()
            }}
          />
          <button type="button" className="tiny" onClick={submit}>
            添加
          </button>
        </div>
      ) : (
        <p className="empty">实时行情接入后才能设置提醒。</p>
      )}
      {alerts.length ? (
        <ul className="alert-list">
          {alerts
            .slice()
            .reverse()
            .map((a) => (
              <li key={a.id} className={a.triggered ? 'fired' : ''}>
                <span className={`alert-side ${a.side}`}>{a.side === 'buy' ? '买' : '卖'}</span>
                <b>到达 {formatPrice(a.price)}</b>
                <small>{statusOf(a)}</small>
                <button
                  className="tiny"
                  onClick={() => {
                    play(sfx.run)
                    removeAlert(stock.id, a.id)
                  }}
                >
                  删除
                </button>
              </li>
            ))}
        </ul>
      ) : null}
    </section>
  )
}
