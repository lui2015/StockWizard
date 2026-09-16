import { useEffect, useMemo, useState, type PointerEvent } from 'react'
import { api } from '../api/base'
import { fetchBars, fetchFiveDayBars, fetchIndexTrends, type Bar } from '../api/chart'
import type { TapeIndex } from '../api/eastmoney'
import { formatSigned } from '../utils/holding'
import { formatPrice, medianPrice, pricePercentile } from '../utils/quotes'

type Period = 'minute' | 'day5' | 'day' | 'week' | 'month'

const PERIODS: { id: Period; label: string }[] = [
  { id: 'minute', label: '分时' },
  { id: 'day5', label: '五日' },
  { id: 'day', label: '日K' },
  { id: 'week', label: '周K' },
  { id: 'month', label: '月K' },
]

const W = 320
const H = 168
const PAD = 10

interface EvaItem {
  index_code: string
  pe: number
  pe_percentile: number
}

/** 东财 secid → 蛋卷指数代码：1.000300 → SH000300 */
function evaCodeOf(secid: string) {
  const m = /^([12])\.(\d{6})$/.exec(secid)
  if (!m) return ''
  return `${m[1] === '1' ? 'SH' : 'SZ'}${m[2]}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function yOf(value: number, min: number, span: number) {
  return H - PAD - ((value - min) / span) * (H - PAD * 2)
}

export function IndexDetail({ index, onClose }: { index: TapeIndex; onClose: () => void }) {
  const [period, setPeriod] = useState<Period>('minute')
  const [bars, setBars] = useState<Bar[]>([])
  const [prevClose, setPrevClose] = useState<number | undefined>()
  const [status, setStatus] = useState<'load' | 'ok' | 'empty'>('load')
  const [cursor, setCursor] = useState<number | null>(null)
  const [history, setHistory] = useState<number[]>([])
  const [eva, setEva] = useState<EvaItem | null>(null)

  // 近 5 年日K：算点数中位数与分位
  useEffect(() => {
    let alive = true
    fetchBars(index.bar, 'day', 1250)
      .then((next) => {
        if (alive) setHistory(next.map((b) => b.close).filter((n) => n > 0))
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [index.id, index.bar])

  // 指数估值（蛋卷），拿不到就显示 —
  useEffect(() => {
    let alive = true
    const code = evaCodeOf(index.id)
    if (!code) {
      setEva(null)
      return
    }
    fetch(api('/radar/eva'), { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((json: { data?: { items?: EvaItem[] } }) => {
        if (!alive) return
        setEva(json.data?.items?.find((item) => item.index_code === code) ?? null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [index.id])

  // 各周期 K 线
  useEffect(() => {
    let alive = true
    setStatus('load')
    setCursor(null)
    setBars([])
    const run = async (): Promise<{ bars: Bar[]; prevClose?: number }> => {
      if (period === 'minute') {
        return { bars: await fetchIndexTrends(index.id, 1) }
      }
      if (period === 'day5') {
        return fetchFiveDayBars(index.bar)
      }
      const lmt = period === 'day' ? 250 : period === 'week' ? 260 : 120
      return { bars: await fetchBars(index.bar, period, lmt) }
    }
    void run()
      .then((next) => {
        if (!alive) return
        setBars(next.bars)
        setPrevClose(next.prevClose)
        setStatus(next.bars.length ? 'ok' : 'empty')
      })
      .catch(() => {
        if (!alive) return
        setBars([])
        setStatus('empty')
      })
    return () => {
      alive = false
    }
  }, [index.id, index.bar, period])

  const view = useMemo(() => {
    if (!bars.length) return null
    const lows = bars.map((b) => b.low)
    const highs = bars.map((b) => b.high)
    const min = Math.min(...lows)
    const max = Math.max(...highs)
    return { min, span: max - min || 1 }
  }, [bars])

  const mid5y = useMemo(() => medianPrice(history), [history])
  const rank = useMemo(() => pricePercentile(index.price, history), [index.price, history])

  const active = cursor != null ? bars[cursor] : bars[bars.length - 1]
  const lineMode = period === 'minute' || period === 'day5'
  const lineColor =
    period === 'day5'
      ? (active?.close ?? 0) >= (bars[0]?.close ?? 0)
        ? '#C41E3A'
        : '#2D5A27'
      : (active?.close ?? 0) >= (prevClose ?? bars[0]?.close ?? 0)
        ? '#C41E3A'
        : '#2D5A27'
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
    <div className="index-detail">
      <header className="panel-head row">
        <div>
          <h2>{index.name}</h2>
          <p>
            {index.id.split('.')[1]} · {formatPrice(index.price)}{' '}
            <span className={index.pct >= 0 ? 'up' : 'down'}>
              {formatSigned(index.change)} · {formatSigned(index.pct)}%
            </span>
          </p>
        </div>
        <button className="tiny" onClick={onClose}>
          返回
        </button>
      </header>

      <div className="metric-board tape-metrics">
        <section className="metric-group">
          <h3>点数</h3>
          <ul className="metric-grid">
            <li>
              <span>近5年中位</span>
              <b>{mid5y == null ? '—' : formatPrice(mid5y)}</b>
            </li>
            <li>
              <span>点数分位</span>
              <b>{rank == null ? '—' : `${Math.round(rank)}%`}</b>
            </li>
            <li>
              <span>历史样本</span>
              <b>{history.length ? `${history.length} 日` : '—'}</b>
            </li>
          </ul>
        </section>
        <section className="metric-group">
          <h3>估值</h3>
          <ul className="metric-grid">
            <li>
              <span>市盈率</span>
              <b>{eva && eva.pe > 0 ? eva.pe.toFixed(2) : '—'}</b>
            </li>
            <li>
              <span>PE 历史分位</span>
              <b>{eva && eva.pe_percentile > 0 ? `${Math.round(eva.pe_percentile * 100)}%` : '—'}</b>
            </li>
            <li>
              <span>估值更新</span>
              <b>{eva ? '每日' : '暂无'}</b>
            </li>
          </ul>
        </section>
      </div>

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
        <p className={`chart-readout ${lineMode ? '' : active && active.close >= active.open ? 'up' : 'down'}`}>
          {status === 'load'
            ? '正在读取K线…'
            : !active
              ? '这周期还没有数据。'
              : lineMode
                ? `${active.time}  点数 ${formatPrice(active.close)}`
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
            {lineMode && prevClose ? (
              <line
                x1={PAD}
                x2={W - PAD}
                y1={yOf(prevClose, view.min, view.span)}
                y2={yOf(prevClose, view.min, view.span)}
                stroke="#1A1A1A"
                strokeDasharray="4 4"
                strokeOpacity="0.35"
              />
            ) : null}
            {lineMode ? (
              <polyline
                fill="none"
                stroke={lineColor}
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
                const color = bar.close >= bar.open ? '#C41E3A' : '#2D5A27'
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
                  cy={yOf(active.close, view.min, view.span)}
                  r="3.5"
                  fill="#1A1A1A"
                />
              </>
            ) : null}
          </svg>
        ) : (
          <div className="chart-empty">{status === 'load' ? '读取中' : '暂无数据'}</div>
        )}
        <p className="chart-hint">按住图上拖动，查看对应时刻的点数。</p>
      </div>
    </div>
  )
}
