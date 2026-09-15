import { useEffect, useRef, useState } from 'react'
import { searchStocks, type MarketHit } from '../api/eastmoney'
import { TypeBadge } from './TypeBadge'
import { inferTypes } from '../utils/wildStock'

export function StockRadar({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (hit: MarketHit) => Promise<void>
}) {
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<MarketHit[]>([])
  const [loading, setLoading] = useState(false)
  const [picking, setPicking] = useState('')
  const [error, setError] = useState('')
  const [active, setActive] = useState(0)
  const seq = useRef(0)
  const listRef = useRef<HTMLOListElement>(null)

  useEffect(() => {
    const keyword = q.trim()
    if (!keyword) {
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
        const next = await searchStocks(keyword)
        if (id !== seq.current) return
        setHits(next)
        setActive(0)
        setError(next.length ? '' : '没有匹配的 A股 / 港股，再补几个字。')
      } catch {
        if (id !== seq.current) return
        setHits([])
        setError('雷达连不上行情源。确认本地服务已启动后再试。')
      } finally {
        if (id === seq.current) setLoading(false)
      }
    }, 220)

    return () => window.clearTimeout(timer)
  }, [q])

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
          <p>输入即联想 · 东方财富 · A股 / 港股</p>
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
          placeholder="输入名称 / 代码 / 拼音，自动联想"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              if (hits.length) setActive((i) => (i + 1) % hits.length)
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              if (hits.length) setActive((i) => (i - 1 + hits.length) % hits.length)
            }
            if (e.key === 'Enter' && hits[active]) {
              e.preventDefault()
              pick(hits[active])
            }
          }}
        />
        <span className="radar-status">{loading ? '联想中…' : hits.length ? `${hits.length} 只` : '待命'}</span>
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
                onMouseEnter={() => setActive(idx)}
                onClick={() => pick(hit)}
              >
                <em>{hit.board}</em>
                <span className="dex-name">
                  <b>{markMatch(hit.name, q)}</b>
                  <small>{markMatch(hit.market === 'HK' ? `${hit.code}.HK` : hit.code, q)}</small>
                </span>
                <span className="type-row compact">
                  {types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </span>
                <i className="go">{picking === hit.id ? '…' : '遇'}</i>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
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
