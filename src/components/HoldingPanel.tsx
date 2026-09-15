import { useEffect, useState } from 'react'
import type { Holding, Quote } from '../data/types'
import { formatSigned, positionOf } from '../utils/holding'
import { formatPrice } from '../utils/quotes'

export function HoldingPanel({
  holding,
  quote,
  onSave,
  onClear,
}: {
  holding?: Holding
  quote: Quote
  onSave: (next: Holding) => void
  onClear: () => void
}) {
  const [open, setOpen] = useState(false)
  const [cost, setCost] = useState(holding?.cost ? String(holding.cost) : '')
  const [qty, setQty] = useState(holding?.qty ? String(holding.qty) : '')
  const pos = positionOf(holding, quote)

  useEffect(() => {
    setCost(holding?.cost ? String(holding.cost) : '')
    setQty(holding?.qty ? String(holding.qty) : '')
  }, [holding?.cost, holding?.qty])

  return (
    <div className={`hold-panel ${open ? 'open' : ''}`}>
      <button className="hold-toggle" onClick={() => setOpen((v) => !v)}>
        <span>持仓</span>
        <strong className={pos ? (pos.pnl >= 0 ? 'up' : 'down') : 'mute'}>
          {pos ? `${formatSigned(pos.pnl)} ${formatSigned(pos.pct)}%` : '未建仓'}
          <i>{open ? '收起' : '展开'}</i>
        </strong>
      </button>
      {open ? (
      <div className="hold-body">
      <div className="hold-fields">
        <label>
          买入价
          <input
            inputMode="decimal"
            value={cost}
            onChange={(e) => setCost(e.target.value)}
            placeholder="例如 80.50"
          />
        </label>
        <label>
          数量
          <input
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            placeholder="例如 100"
          />
        </label>
      </div>
      <div className="hold-actions">
        <button
          className="btn"
          onClick={() => {
            const nextCost = Number(cost)
            const nextQty = Number(qty)
            if (!(nextCost > 0) || !(nextQty > 0)) return
            onSave({ cost: nextCost, qty: nextQty })
          }}
        >
          记仓
        </button>
        {holding ? (
          <button className="btn ghost" onClick={onClear}>
            清仓
          </button>
        ) : null}
      </div>
      {pos ? (
        <ul className="hold-stats">
          <li>
            <span>成本</span>
            <b>{formatPrice(pos.cost)}</b>
          </li>
          <li>
            <span>市值</span>
            <b>{quote.live ? formatPrice(pos.market) : '——.—'}</b>
          </li>
          <li>
            <span>盈亏</span>
            <b className={pos.pnl >= 0 ? 'up' : 'down'}>
              {formatSigned(pos.pnl)}（{formatSigned(pos.pct)}%）
            </b>
          </li>
        </ul>
      ) : (
        <p className="hold-empty">还没记仓。填买入价和数量，只做纸上推演。</p>
      )}
      </div>
      ) : null}
    </div>
  )
}
