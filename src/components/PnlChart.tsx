import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { fetchChart, type Bar, type ChartPeriod } from '../api/chart'
import type { Holding, StockSprite } from '../data/types'
import { formatSigned } from '../utils/holding'

/** 区间预设：天数（0 = 全部历史） */
const RANGES: { label: string; days: number }[] = [
  { label: '30天', days: 30 },
  { label: '60天', days: 60 },
  { label: '180天', days: 180 },
  { label: '全部', days: 0 },
]

const W = 320
const H = 150
const PAD_L = 8
const PAD_R = 44 // 右侧留给数值轴
const PAD_Y = 10

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function yOf(value: number, min: number, span: number) {
  return H - PAD_Y - ((value - min) / span) * (H - PAD_Y * 2)
}

function shortDate(time: string) {
  const m = time.match(/(\d{4})-(\d{2})-(\d{2})/)
  return m ? `${m[2]}-${m[3]}` : time
}

/**
 * 持仓盈亏走势：按持仓成本把历史日K换算成盈亏曲线，
 * 渐变面积图 + 0 轴成本线 + 右侧数值轴 + 底部区间汇总。
 */
export function PnlChart({
  stock,
  holding,
}: {
  stock: StockSprite
  holding: Holding
}) {
  const [days, setDays] = useState(180)
  const [bars, setBars] = useState<Bar[]>([])
  const [status, setStatus] = useState<'load' | 'ok' | 'empty'>('load')
  const [cursor, setCursor] = useState<number | null>(null)

  useEffect(() => {
    let alive = true
    setStatus('load')
    setCursor(null)
    void fetchChart(stock, 'day' as ChartPeriod, days || 1300)
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
  }, [stock.id, stock.code, stock.market, days])

  const pnlOf = (close: number) => (close - holding.cost) * holding.qty

  const view = useMemo(() => {
    if (!bars.length) return null
    const values = bars.map((b) => pnlOf(b.close))
    const min = Math.min(0, ...values)
    const max = Math.max(0, ...values)
    return { values, min, max, span: max - min || 1 }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, holding.cost, holding.qty])

  const lastPnl = bars.length ? pnlOf(bars[bars.length - 1].close) : 0
  const lastPct = bars.length ? ((bars[bars.length - 1].close - holding.cost) / holding.cost) * 100 : 0
  const color = lastPnl >= 0 ? '#C41E3A' : '#2D5A27'
  const step = bars.length > 1 ? (W - PAD_L - PAD_R) / (bars.length - 1) : 0
  const xOf = (i: number) => PAD_L + i * step

  const highPnl = view ? Math.max(...view.values) : 0
  const lowPnl = view ? Math.min(...view.values) : 0
  const active = cursor != null ? bars[cursor] : null

  const pick = (e: PointerEvent<SVGSVGElement>) => {
    if (!bars.length) return
    const svg = e.currentTarget
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const ctm = svg.getScreenCTM()
    if (!ctm) return
    const loc = pt.matrixTransform(ctm.inverse())
    setCursor(clamp(Math.round((loc.x - PAD_L) / (step || 1)), 0, bars.length - 1))
  }

  // 右侧数值轴：最高、0（跨 0 时）、最低
  const ticks = useMemo(() => {
    if (!view) return []
    const set = new Set<number>()
    if (Number.isFinite(view.max)) set.add(Math.round(view.max))
    if (view.min < 0 && view.max > 0) set.add(0)
    if (Number.isFinite(view.min)) set.add(Math.round(view.min))
    return [...set]
  }, [view])

  return (
    <div className="pnl-card">
      <header className="pnl-head">
        <h3>持仓盈亏走势</h3>
        <div className="pnl-ranges">
          {RANGES.map((item) => (
            <button
              key={item.label}
              className={days === item.days ? 'on' : ''}
              onClick={() => setDays(item.days)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </header>

      {status === 'ok' && view && bars.length > 1 ? (
        <>
          <svg
            className="pnl-svg"
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
            <defs>
              <linearGradient id="pnl-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.26" />
                <stop offset="100%" stopColor={color} stopOpacity="0.03" />
              </linearGradient>
            </defs>
            {Array.from({ length: 4 }, (_, i) => (
              <line
                key={i}
                x1={PAD_L}
                x2={W - PAD_R}
                y1={(i * H) / 4}
                y2={(i * H) / 4}
                stroke="#1A1A1A"
                strokeOpacity="0.08"
                strokeWidth="1"
              />
            ))}
            {view.min < 0 && view.max > 0 ? (
              <line
                x1={PAD_L}
                x2={W - PAD_R}
                y1={yOf(0, view.min, view.span)}
                y2={yOf(0, view.min, view.span)}
                stroke="#1A1A1A"
                strokeDasharray="4 4"
                strokeOpacity="0.4"
              />
            ) : null}
            <path
              d={`M ${xOf(0)},${yOf(view.values[0], view.min, view.span)} ${bars
                .slice(1)
                .map(
                  (_bar, i) =>
                    `L ${xOf(i + 1)},${yOf(view.values[i + 1], view.min, view.span)}`,
                )
                .join(' ')} L ${xOf(bars.length - 1)},${H - PAD_Y} L ${xOf(0)},${H - PAD_Y} Z`}
              fill="url(#pnl-fill)"
            />
            <polyline
              fill="none"
              stroke={color}
              strokeWidth="2.2"
              strokeLinejoin="round"
              points={bars
                .map((_bar, i) => `${xOf(i)},${yOf(view.values[i], view.min, view.span)}`)
                .join(' ')}
            />
            <circle
              cx={xOf(bars.length - 1)}
              cy={yOf(view.values[view.values.length - 1], view.min, view.span)}
              r="3.2"
              fill={color}
            />
            {ticks.map((t) => (
              <text
                key={t}
                x={W - PAD_R + 5}
                y={yOf(t, view.min, view.span) + 3.5}
                fontSize="9"
                fill="#1A1A1A"
                fillOpacity="0.55"
              >
                {t}
              </text>
            ))}
            {cursor != null && active ? (
              <>
                <line
                  x1={xOf(cursor)}
                  x2={xOf(cursor)}
                  y1={0}
                  y2={H}
                  stroke="#1A1A1A"
                  strokeWidth="1.2"
                  strokeDasharray="3 3"
                />
                <circle
                  cx={xOf(cursor)}
                  cy={yOf(view.values[cursor], view.min, view.span)}
                  r="3"
                  fill="#1A1A1A"
                />
              </>
            ) : null}
          </svg>

          <div className="pnl-xaxis">
            <span>{shortDate(bars[0].time)}</span>
            <span>{shortDate(bars[Math.floor((bars.length - 1) / 2)].time)}</span>
            <span>{shortDate(bars[bars.length - 1].time)}</span>
          </div>

          <div className="pnl-summary">
            {active ? (
              <>
                <b className={active ? (pnlOf(active.close) >= 0 ? 'up' : 'down') : ''}>
                  {formatSigned(pnlOf(active.close))}（{formatSigned(((active.close - holding.cost) / holding.cost) * 100)}%）
                </b>
                <span>{active.time}</span>
              </>
            ) : (
              <>
                <b className={lastPnl >= 0 ? 'up' : 'down'}>
                  {formatSigned(lastPnl)}（{formatSigned(lastPct)}%）
                </b>
                <span>
                  {shortDate(bars[0].time)} ~ {shortDate(bars[bars.length - 1].time)} ·{' '}
                  {bars.length} 交易日 · 区间最高 {formatSigned(highPnl)} / 最低{' '}
                  {formatSigned(lowPnl)}
                </span>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="chart-empty">{status === 'load' ? '读取中' : '暂无历史数据'}</div>
      )}
      <p className="chart-hint">
        按住图上拖动，查看对应时刻的持仓盈亏；按历史收盘价 × 当时的份额与成本还原。
      </p>
    </div>
  )
}
