import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { fetchChart, type Bar, type ChartPeriod } from '../api/chart'
import type { Holding, StockSprite } from '../data/types'
import { formatSigned } from '../utils/holding'

const PERIODS: { id: ChartPeriod; label: string }[] = [
  { id: 'minute', label: '分时' },
  { id: 'day', label: '日K' },
  { id: 'week', label: '周K' },
  { id: 'month', label: '月K' },
]

const W = 320
const H = 168
const PAD = 10

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function yOf(value: number, min: number, span: number) {
  return H - PAD - ((value - min) / span) * (H - PAD * 2)
}

/**
 * 持仓盈亏走势图：按持仓成本把价格序列换算成盈亏曲线，
 * 0 轴为成本线，支持拖动查看对应时刻的盈亏金额与收益率。
 */
export function PnlChart({
  stock,
  holding,
}: {
  stock: StockSprite
  holding: Holding
}) {
  const [period, setPeriod] = useState<ChartPeriod>('minute')
  const [bars, setBars] = useState<Bar[]>([])
  const [status, setStatus] = useState<'load' | 'ok' | 'empty'>('load')
  const [cursor, setCursor] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setStatus('load')
    setCursor(null)
    void fetchChart(stock, period)
      .then((next) => {
        if (!alive) return
        setBars(next)
        setStatus(next.length ? 'ok' : 'empty')
      })
      .catch(() => {
        if (!alive) return
        setBars([])
        setStatus('empty')
      })
    return () => {
      alive = false
    }
  }, [stock.id, stock.code, stock.market, period])

  const pnlOf = (close: number) => (close - holding.cost) * holding.qty

  const view = useMemo(() => {
    if (!bars.length) return null
    const values = bars.map((b) => pnlOf(b.close))
    const min = Math.min(0, ...values)
    const max = Math.max(0, ...values)
    return { min, span: max - min || 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, holding.cost, holding.qty])

  const active = cursor != null ? bars[cursor] : bars[bars.length - 1]
  const activePnl = active ? pnlOf(active.close) : 0
  const lastPnl = bars.length ? pnlOf(bars[bars.length - 1].close) : 0
  const color = lastPnl >= 0 ? '#C41E3A' : '#2D5A27'
  const step = bars.length > 1 ? (W - PAD * 2) / (bars.length - 1) : 0

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!bars.length) return
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const loc = pt.matrixTransform(ctm.inverse())
    setCursor(clamp(Math.round((loc.x - PAD) / (step || 1)), 0, bars.length - 1))
  }

  return (
    <div className="price-chart pnl-chart">
      <div className="tabs chart-tabs">
        {PERIODS.map((item) => (
          <button
            key={item.id}
            className={period === item.id ? 'on' : ''}
            onClick={() => setPeriod(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className={`chart-readout ${activePnl >= 0 ? 'up' : 'down'}`}>
        {status === 'load'
          ? '正在读取K线…'
          : !active
            ? '这周期还没有K线。'
            : `${active.time}  盈亏 ${formatSigned(activePnl)}（${(((active.close - holding.cost) / holding.cost) * 100).toFixed(2)}%）`}
      </p>
      {status === 'ok' && view ? (
        <svg
          className="spark chart-svg"
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          height={H}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            pick(e)
          }}
          onPointerMove={pick}
          onPointerUp={() => setCursor(null)}
          onPointerLeave={() => setCursor(null)}
        >
          {Array.from({ length: 5 }, (_, i) => (
            <line
              key={i}
              x1="0"
              x2={W}
              y1={(i * H) / 4}
              y2={(i * H) / 4}
              stroke="#1A1A1A"
              strokeOpacity="0.12"
              strokeWidth="1"
            />
          ))}
          {/* 成本线（盈亏 0 轴） */}
          <line
            x1={PAD}
            x2={W - PAD}
            y1={yOf(0, view.min, view.span)}
            y2={yOf(0, view.min, view.span)}
            stroke="#1A1A1A"
            strokeDasharray="4 4"
            strokeOpacity="0.4"
          />
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            points={bars
              .map((bar, i) => `${PAD + i * step},${yOf(pnlOf(bar.close), view.min, view.span)}`)
              .join(' ')}
          />
          {cursor != null && active ? (
            <>
              <line
                x1={PAD + cursor * step}
                x2={PAD + cursor * step}
                y1={0}
                y2={H}
                stroke="#1A1A1A"
                strokeWidth="1.5"
                strokeDasharray="3 3"
              />
              <circle
                cx={PAD + cursor * step}
                cy={yOf(activePnl, view.min, view.span)}
                r="3.5"
                fill="#1A1A1A"
              />
            </>
          ) : null}
        </svg>
      ) : (
        <div className="chart-empty">{status === 'load' ? '读取中' : '暂无K线'}</div>
      )}
      <p className="chart-hint">
        按住图上拖动，查看对应时刻的持仓盈亏。当前盈亏 {formatSigned(lastPnl)}。
      </p>
    </div>
  )
}
