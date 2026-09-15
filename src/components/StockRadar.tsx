import { useEffect, useRef, useState } from 'react'
import {
  matchMarket,
  RADAR_BOARDS,
  screenStocks,
  searchStocks,
  type MarketHit,
  type RadarBoard,
  type RadarMarket,
} from '../api/eastmoney'
import { ALL_SECTORS, SECTOR_META } from '../data/sectors'
import type { Sector } from '../data/types'
import { TypeBadge } from './TypeBadge'
import { inferTypes } from '../utils/wildStock'

const MARKETS: { id: RadarMarket; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'CN', label: 'A股' },
  { id: 'HK', label: '港股' },
  { id: 'SH', label: '沪市' },
  { id: 'SZ', label: '深市' },
  { id: 'CYB', label: '创业板' },
  { id: 'KCB', label: '科创板' },
]

export function StockRadar({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (hit: MarketHit) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [market, setMarket] = useState<RadarMarket>('all')
  const [board, setBoard] = useState<RadarBoard>('all')
  const [sector, setSector] = useState<Sector | 'all'>('all')
  const [hits, setHits] = useState<MarketHit[]>([])
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState('')
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const seq = useRef(0)
  const listRef = useRef<HTMLOListElement>(null)
  const filtered = market !== 'all' || board !== 'all' || sector !== 'all'

  useEffect(() => {
    const keyword = q.trim()
    if (!keyword && !filtered) {
      seq.current += 1
      setHits([])
      setError('')
      setLoading(false)
      setActive(0)
      return
    }

    const id = ++seq.current
    setLoading(true)
    setError('')
    const timer = window.setTimeout(async () => {
      try {
        const next = keyword
          ? await refineSearch(keyword, market, board, sector)
          : await refineScreen(market, board, sector)
        if (id !== seq.current) return
        setHits(next)
        setActive(0)
        setError(next.length ? '' : '这个条件下没有精灵，换一组条件或再补几个字。')
      } catch {
        if (id !== seq.current) return
        setHits([])
        setError('雷达连不上行情源。确认本地服务已启动后再试。')
      } finally {
        if (id === seq.current) setLoading(false)
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [q, market, board, sector, filtered])

  useEffect(() => {
    const row = listRef.current?.querySelectorAll('button')[active]
    row?.scrollIntoView({ block: 'nearest' })
  }, [active])

  const pick = (hit: MarketHit) => {
    setPicking(hit.id)
    void onPick(hit).finally(() => setPicking(''))
  }

  return (
    <div className="radar">
      <header className="panel-head row">
        <div>
          <h2>精灵雷达</h2>
          <p>输入联想，或点条件扫货 · 东方财富 · A股 / 港股</p>
        </div>
        <button className="tiny" onClick={onClose}>
          关闭
        </button>
      </header>
      <div className="radar-form">
        <input
          className="search"
          data-radar-q
          autoFocus
          placeholder="输入名称 / 代码 / 拼音，或先点下面的条件"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (hits.length) setActive((i) => (i + 1) % hits.length)
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (hits.length) setActive((i) => (i + hits.length - 1) % hits.length)
            }
            if (e.key === 'Enter' && hits[active]) {
              e.preventDefault()
              pick(hits[active])
            }
          }}
        />
        <span className="radar-status">
          {loading ? (q.trim() ? '联想中…' : '扫货中…') : hits.length ? `${hits.length} 只` : '待命'}
        </span>
      </div>
      <div className="radar-filters">
        <FilterRow label="市场" value={market} options={MARKETS} onPick={setMarket} />
        <FilterRow
          label="板块"
          value={board}
          options={RADAR_BOARDS.map((item) => ({ id: item.id, label: item.label }))}
          onPick={setBoard}
        />
        <FilterRow
          label="行业"
          value={sector}
          options={[{ id: 'all' as const, label: '全部' }, ...ALL_SECTORS.map((t) => ({ id: t, label: SECTOR_META[t].name }))]}
          onPick={setSector}
        />
      </div>
      {error ? <p className="empty">{error}</p> : null}
      <ol className="dex-list radar-list" ref={listRef}>
        {hits.map((hit, idx) => {
          const types = inferTypes(hit.name, hit.market)
          return (
            <li key={hit.id}>
              <button
                className={`dex-row ${idx === active ? 'on' : ''}`}
                disabled={Boolean(picking)}
                onClick={() => pick(hit)}
                onMouseEnter={() => setActive(idx)}
              >
                <em>{hit.board}</em>
                <span className="dex-name">
                  <b>{markMatch(hit.name, q)}</b>
                  <small>
                    {markMatch(hit.market === 'HK' ? `${hit.code}.HK` : hit.code, q)}
                    {hit.pct != null ? (
                      <span className={hit.pct >= 0 ? 'up' : 'down'}>
                        {` · ${hit.pct >= 0 ? '▲' : '▼'}${Math.abs(hit.pct).toFixed(2)}%`}
                      </span>
                    ) : null}
                  </small>
                </span>
                <span className="type-row compact">
                  {types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function FilterRow<T extends string>({
  label,
  value,
  options,
  onPick,
}: {
  label: string
  value: T
  options: { id: T; label: string }[]
  onPick: (id: T) => void
}) {
  return (
    <div className="radar-filter">
      <em>{label}</em>
      <div className="type-row compact">
        {options.map((opt) => (
          <button
            key={opt.id}
            type="button"
            className={value === opt.id ? 'chip on' : 'chip'}
            onClick={() => onPick(opt.id)}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

async function refineSearch(
  keyword: string,
  market: RadarMarket,
  board: RadarBoard,
  sector: Sector | 'all',
) {
  if (board !== 'all') {
    return screenStocks({ market, sector: 'all', board, keyword })
  }
  let next = (await searchStocks(keyword)).filter((hit) => matchMarket(hit, market))
  if (sector !== 'all') {
    next = next.filter((hit) => inferTypes(hit.name, hit.market).includes(sector))
  }
  return next
}

async function refineScreen(market: RadarMarket, board: RadarBoard, sector: Sector | 'all') {
  const next = await screenStocks({ market, sector, board })
  if (sector === 'all' || board !== 'all') return next
  if (market !== 'HK' && sector !== 'conglomerate') return next
  return next.filter((hit) => inferTypes(hit.name, hit.market).includes(sector))
}

function markMatch(text: string, q: string) {
  const needle = q.trim()
  if (!needle) return text
  const i = text.toLowerCase().indexOf(needle.toLowerCase())
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + needle.length)}</mark>
      {text.slice(i + needle.length)}
    </>
  )
}
