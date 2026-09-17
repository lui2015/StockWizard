import { useMemo, useState } from 'react'
import { ALL_SECTORS, SECTOR_META } from '../data/sectors'
import type { Sector } from '../data/types'
import { PixelSprite } from '../components/PixelSprite'
import { useGame } from '../store/gameStore'
import { levelOf } from '../utils/stats'
import { sfx } from '../utils/sound'

export function Pokedex() {
  const { save, catalog, quotes, setScreen, play } = useGame()
  const [q, setQ] = useState('')
  const [type, setType] = useState<Sector | 'all'>('all')

  const list = useMemo(() => {
    return catalog.filter((s) => {
      const hit =
        !q ||
        s.name.includes(q) ||
        s.code.toLowerCase().includes(q.toLowerCase()) ||
        String(s.no).includes(q)
      const typed = type === 'all' || s.types.includes(type)
      return hit && typed
    })
  }, [q, type, catalog])

  return (
    <div className="panel dex-panel">
      <header className="panel-head row">
        <div>
          <h2>精灵图鉴</h2>
          <p>
            遇见 {save.seen.length}/{catalog.length} · 捕捉 {save.captured.length}/{catalog.length}
          </p>
        </div>
      </header>

      <div className="dex-tools">
        <input
          className="search"
          placeholder="搜名称 / 代码 / 编号"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="type-row">
          <button className={type === 'all' ? 'chip on' : 'chip'} onClick={() => setType('all')}>
            全部
          </button>
          {ALL_SECTORS.map((t) => (
            <button
              key={t}
              className={type === t ? 'chip on' : 'chip'}
              onClick={() => setType(t)}
            >
              {SECTOR_META[t].name}
            </button>
          ))}
        </div>
      </div>

      <ol className="dex-list">
        {list.map((s) => {
          const seen = save.seen.includes(s.id)
          const caught = save.captured.includes(s.id)
          return (
            <li key={s.id}>
              <button
                className="dex-row"
                onClick={() => {
                  play(sfx.select)
                  setScreen({ name: 'detail', id: s.id, tab: 'dex' })
                }}
              >
                <em>No.{String(s.no).padStart(2, '0')}</em>
                <PixelSprite stock={s} size="sm" silhouette={!seen} />
                <span className="dex-name">
                  <b>{seen ? s.name : '?????'}</b>
                  <small>
                    {seen ? s.code : '------'}
                    {' · '}
                    {seen
                      ? `Lv.${levelOf(s, quotes[s.id] ?? { price: s.basePrice, open: s.basePrice, series: [s.basePrice] })}`
                      : 'Lv.--'}
                  </small>
                </span>
                <i className={`ball ${caught ? 'caught' : seen ? 'seen' : ''}`} />
              </button>
            </li>
          )
        })}
      </ol>
      {list.length === 0 ? <p className="empty">草丛里没有符合条件的精灵。</p> : null}
    </div>
  )
}
