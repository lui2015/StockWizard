import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { fetchChart, type Bar, type ChartPeriod } from '../api/chart'
import type { Quote, StockSprite } from '../data/types'
import { formatPrice } from '../utils/quotes'

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

export function PriceChart({
  stock,
  quote,
}: {
  stock: StockSprite
  quote?: Quote
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

  const view = useMemo(() => {
    if (!bars.length) return null
    const lows = bars.map((b) => b.low)
    const highs = bars.map((b) => b.high)
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    return { min, span: max - min || 1 }
  }, [bars])

  const active = cursor != null ? bars[cursor] : bars[bars.length - 1]
  const up = active ? active.close >= active.open : true
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
    <div className="price-chart">
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
      <p className={`chart-readout ${up ? 'up' : 'down'}`}>
        {status === 'load'
          ? '正在读取K线…'
          : !active
            ? '这周期还没有K线。'
            : period === 'minute'
              ? `${active.time}  现价 ${formatPrice(active.close)}`
              : `${active.time}  开${formatPrice(active.open)} 收${formatPrice(active.close)} 高${formatPrice(active.high)} 低${formatPrice(active.low)}`}
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
          {period === 'minute' && quote?.prevClose ? (
            <line
              x1={PAD}
              x2={W - PAD}
              y1={yOf(quote.prevClose, view.min, view.span)}
              y2={yOf(quote.prevClose, view.min, view.span)}
              stroke="#1A1A1A"
              strokeDasharray="4 4"
              strokeOpacity="0.35"
            />
          ) : null}
          {period === 'minute' ? (
            <polyline
              fill="none"
              stroke={bars[bars.length - 1].close >= (quote?.prevClose || bars[0].close) ? '#C41E3A' : '#2D5A27'}
              strokeWidth="2.5"
              points={bars
                .map((bar, i) => `${PAD + i * step},${yOf(bar.close, view.min, view.span)}`)
                .join(' ')}
            />
          ) : (
            bars.map((bar, i) => {
              const x = PAD + i * step
              const bodyW = Math.max(2, step * 0.62)
              const yHigh = yOf(bar.high, view.min, view.span)
              const yLow = yOf(bar.low, view.min, view.span)
              const yOpen = yOf(bar.open, view.min, view.span)
              const yClose = yOf(bar.close, view.min, view.span)
              const top = Math.min(yOpen, yClose)
              const h = Math.max(1.5, Math.abs(yClose - yOpen))
              const rise = bar.close >= bar.open
              const color = rise ? '#C41E3A' : '#2D5A27'
              return (
                <g key={`${bar.time}-${i}`}>
                  <line x1={x} x2={x} y1={yHigh} y2={yLow} stroke={color} strokeWidth="1.4" />
                  <rect x={x - bodyW / 2} y={top} width={bodyW} height={h} fill={color} />
                </g>
              )
            })
          )}
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
                cy={yOf(period === 'minute' ? active.close : active.close, view.min, view.span)}
                r="3.5"
                fill="#1A1A1A"
              />
            </>
          ) : null}
        </svg>
      ) : (
        <div className="chart-empty">{status === 'load' ? '读取中' : '暂无K线'}</div>
      )}
      <p className="chart-hint">按住图上拖动，查看对应时刻的价格。</p>
    </div>
  )
}
