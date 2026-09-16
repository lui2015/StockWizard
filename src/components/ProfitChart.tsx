import { useEffect, useMemo, useState } from 'react'
import { api } from '../api/base'

interface FinRow {
  REPORT_DATE?: string
  PARENTNETPROFIT?: number
  PARENTNETPROFITTZ?: number
}

/** 东财 quoteId → F10 SECUCODE：1.600519 → 600519.SH */
function secuOf(quoteId: string): string | null {
  const [mkt, code] = quoteId.split('.')
  if (mkt === '1') return `${code}.SH`
  if (mkt === '0') return `${code}.SZ`
  if (mkt === '116') return `${code}.HK`
  return null
}

function fmtYi(v: number) {
  const yi = v / 1e8
  if (Math.abs(yi) >= 1000) return `${(yi / 1e4).toFixed(2)}万亿`
  return `${yi >= 0 ? '' : '-'}${Math.abs(yi).toFixed(yi >= 0 ? 0 : 1)}亿`
}

const W = 320
const H = 170
const TOP = 26
const BOTTOM = 26
const GAP = 14

export function ProfitChart({ quoteId }: { quoteId: string }) {
  const secu = useMemo(() => secuOf(quoteId), [quoteId])
  const [rows, setRows] = useState<{ year: string; profit: number; yoy?: number }[]>([])
  const [status, setStatus] = useState<'load' | 'ok' | 'none'>('load')

  useEffect(() => {
    if (!secu) {
      setStatus('none')
      return
    }
    let alive = true
    setStatus('load')
    const filter = encodeURIComponent(`(SECUCODE="${secu}")`)
    const url = api(
      `/radar/fin?type=RPT_F10_FINANCE_MAINFINADATA&sty=APP_F10_MAINFINADATA&filter=${filter}&p=1&ps=40&sr=-1&st=REPORT_DATE&source=HSF10&client=PC`,
    )
    fetch(url, { headers: { Accept: 'application/json' } })
      .then((r) => r.json())
      .then((j: { result?: { data?: FinRow[] } }) => {
        if (!alive) return
        const data = j.result?.data ?? []
        const annual = data
          .filter((x) => (x.REPORT_DATE ?? '').includes('-12-31') && typeof x.PARENTNETPROFIT === 'number')
          .slice(0, 5)
          .map((x) => ({
            year: (x.REPORT_DATE ?? '').slice(0, 4),
            profit: x.PARENTNETPROFIT as number,
            yoy: x.PARENTNETPROFITTZ,
          }))
          .reverse()
        setRows(annual)
        setStatus(annual.length ? 'ok' : 'none')
      })
      .catch(() => {
        if (!alive) return
        setRows([])
        setStatus('none')
      })
    return () => {
      alive = false
    }
  }, [secu])

  const view = useMemo(() => {
    if (!rows.length) return null
    const maxAbs = Math.max(...rows.map((r) => Math.abs(r.profit)), 1)
    const hasNeg = rows.some((r) => r.profit < 0)
    // 0 基线位置：全正时贴近底部，有负值时按比例
    const zeroY = hasNeg ? TOP + ((H - TOP - BOTTOM) * maxAbs) / (maxAbs * 2 + 1) : H - BOTTOM
    const unit = (H - TOP - BOTTOM) / (maxAbs * (hasNeg ? 2 : 1))
    const n = rows.length
    const barW = Math.min(44, (W - GAP * 2) / n - 8)
    const step = (W - GAP * 2) / n
    return {
      zeroY,
      unit,
      bars: rows.map((row, i) => {
        const h = Math.max(2, Math.abs(row.profit) * unit)
        return {
          ...row,
          x: GAP + i * step + (step - barW) / 2,
          w: barW,
          y: row.profit >= 0 ? zeroY - h : zeroY,
          h,
        }
      }),
    }
  }, [rows])

  return (
    <section className="fin-chart">
      <h3>近五年归母净利润</h3>
      {status === 'load' ? (
        <p className="empty">正在读取财务数据…</p>
      ) : status === 'none' || !view ? (
        <p className="empty">暂无该公司的财报数据。</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} role="img" aria-label="近五年归母净利润柱状图">
            <line
              x1={4}
              x2={W - 4}
              y1={view.zeroY}
              y2={view.zeroY}
              stroke="#1A1A1A"
              strokeWidth="1.5"
            />
            {view.bars.map((bar) => {
              const color =
                bar.yoy == null ? '#8a94a6' : bar.yoy >= 0 ? '#C41E3A' : '#2D5A27'
              return (
                <g key={bar.year}>
                  <rect x={bar.x} y={bar.y} width={bar.w} height={bar.h} fill={color} stroke="#1A1A1A" strokeWidth="1.5" />
                  <text x={bar.x + bar.w / 2} y={bar.profit >= 0 ? bar.y - 5 : bar.y + bar.h + 12} textAnchor="middle" fontSize="10" fill="#1A1A1A">
                    {fmtYi(bar.profit)}
                  </text>
                  <text x={bar.x + bar.w / 2} y={H - 8} textAnchor="middle" fontSize="11" fill="#1A1A1A">
                    {bar.year}
                  </text>
                </g>
              )
            })}
          </svg>
          <p className="chart-hint">柱高按归母净利润规模等比绘制 · 红色为同比增长，绿色为同比下降 · 单位：人民币</p>
        </>
      )}
    </section>
  )
}
