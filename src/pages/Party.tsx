import { useEffect, useState } from 'react'
import { PixelSprite } from '../components/PixelSprite'
import { TypeBadge } from '../components/TypeBadge'
import { useGame } from '../store/gameStore'
import { fetchChart } from '../api/chart'
import { formatSigned, positionOf } from '../utils/holding'
import {
  changeAmt,
  changePct,
  formatPercent,
  formatPrice,
  formatRatio,
  medianPrice,
  pricePercentile,
} from '../utils/quotes'
import { MAX_SQUADS } from '../utils/squads'
import { levelOf } from '../utils/stats'
import { sfx } from '../utils/sound'

export function Party() {
  const {
    save,
    quotes,
    getSprite,
    setScreen,
    play,
    moveParty,
    release,
    switchSquad,
    addSquad,
    renameSquad,
    removeSquad,
  } = useGame()
  const squad = save.squads.find((s) => s.id === save.activeSquadId) ?? save.squads[0]
  const party = squad?.members ?? []
  const teamHold = party.reduce(
    (acc, id) => {
      const stock = getSprite(id)
      const quote = quotes[id] ?? { price: stock.basePrice }
      const pos = positionOf(save.holdings[id], quote)
      if (!pos) return acc
      return { cost: acc.cost + pos.cost, pnl: acc.pnl + pos.pnl }
    },
    { cost: 0, pnl: 0 },
  )
  const teamPct = teamHold.cost > 0 ? (teamHold.pnl / teamHold.cost) * 100 : null
  const [editing, setEditing] = useState(false)
  const [draftName, setDraftName] = useState(squad?.name ?? '')
  const [dayCloses, setDayCloses] = useState<Record<string, number[]>>({})
  const partyKey = party.join(',')

  useEffect(() => {
    setDraftName(squad?.name ?? '')
  }, [squad?.id, squad?.name])

  useEffect(() => {
    if (!party.length) {
      setDayCloses({})
      return
    }
    let alive = true
    void Promise.all(
      party.map(async (id) => {
        try {
          const bars = await fetchChart(getSprite(id), 'day', 1250)
          return [id, bars.map((bar) => bar.close).filter((n) => n > 0)] as const
        } catch {
          return [id, []] as const
        }
      }),
    ).then((rows) => {
      if (alive) setDayCloses(Object.fromEntries(rows))
    })
    return () => {
      alive = false
    }
  }, [partyKey])

  const commitName = () => {
    if (!squad) return
    const next = draftName.trim().slice(0, 6)
    if (!next) {
      setDraftName(squad.name)
      return
    }
    if (next !== squad.name) {
      renameSquad(squad.id, next)
      play(sfx.blip)
    }
  }

  return (
    <div className="panel party-panel">
      <header className="panel-head row">
        <div>
          <h2>我的队伍</h2>
          <p>出战 {party.length}/6</p>
        </div>
        <div className="head-ops">
          <button
            className="tiny"
            onClick={() => {
              setEditing((v) => !v)
              play(sfx.blip)
            }}
          >
            {editing ? '完成' : '编辑'}
          </button>
        </div>
      </header>

      <div className="squad-bar">
        {save.squads.map((item) => (
          <button
            key={item.id}
            className={item.id === save.activeSquadId ? 'on' : ''}
            onClick={() => {
              if (item.id !== save.activeSquadId) {
                switchSquad(item.id)
                play(sfx.blip)
              }
            }}
          >
            {item.name}
          </button>
        ))}
      </div>
      {editing ? (
        <div className="squad-tools">
          <input
            className="squad-name"
            value={draftName}
            maxLength={6}
            autoFocus
            aria-label="队伍名称"
            onChange={(e) => setDraftName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.currentTarget.blur()
              }
            }}
          />
          {save.squads.length < MAX_SQUADS ? (
            <button
              className="tiny"
              onClick={() => {
                const ok = addSquad()
                play(ok ? sfx.select : sfx.catchFail)
              }}
            >
              新建
            </button>
          ) : null}
          {save.squads.length > 1 ? (
            <button
              className="tiny"
              onClick={() => {
                if (!squad) return
                if (confirm(`删除「${squad.name}」？成员仍留在图鉴里。`)) {
                  removeSquad(squad.id)
                  play(sfx.run)
                }
              }}
            >
              删除
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className={`squad-pnl ${teamPct == null ? 'mute' : teamHold.pnl >= 0 ? 'up' : 'down'}`}
      >
        <span>持仓盈亏</span>
        <strong>
          {teamPct == null ? (
            '未建仓'
          ) : (
            <>
              {formatSigned(teamHold.pnl)}
              <em>{formatSigned(teamPct)}%</em>
            </>
          )}
        </strong>
      </div>

      <ol className="party-list">
        {Array.from({ length: 6 }, (_, i) => {
          const id = party[i]
          if (!id) {
            return (
              <li key={`empty-${i}`} className="party-slot empty">
                <span>————</span>
              </li>
            )
          }
          const stock = getSprite(id)
          const quote = quotes[id] ?? { price: stock.basePrice, open: stock.basePrice, series: [stock.basePrice] }
          const pct = changePct(quote)
          const amt = changeAmt(quote)
          const pos = positionOf(save.holdings[id], quote)
          const closes = dayCloses[id] ?? []
          const rank = pricePercentile(quote.price, closes.slice(-500))
          const mid5y = medianPrice(closes)
          return (
            <li key={id} className={`party-slot ${editing ? 'editing' : ''}`}>
              <button
                className="party-main"
                onClick={() => {
                  play(sfx.select)
                  setScreen({ name: 'detail', id, tab: 'dex' })
                }}
              >
                <PixelSprite stock={stock} size="md" />
                <div className="party-meta">
                  <div className="party-id">
                    <b>
                      <span className="party-name">{stock.name}</span>
                      <small>Lv.{levelOf(stock, quote)}</small>
                    </b>
                    <div className="type-row compact">
                      {stock.types.map((t) => (
                        <TypeBadge key={t} type={t} />
                      ))}
                    </div>
                  </div>
                  <div className={`party-quote ${pct >= 0 ? 'up' : 'down'}`}>
                    <strong>{quote.live ? formatPrice(quote.price) : '——.—'}</strong>
                    <small>
                      {pct >= 0 ? '▲' : '▼'}
                      {pct.toFixed(2)}%
                    </small>
                    <small>
                      {amt >= 0 ? '+' : ''}
                      {formatPrice(amt)}
                    </small>
                  </div>
                  <div className="rank-row">
                    <div className="hp-bar mini">
                      <i
                        style={{ width: `${rank ?? 0}%` }}
                        className={rank == null ? '' : rank >= 70 ? 'ok' : rank <= 30 ? 'low' : 'mid'}
                      />
                    </div>
                    <small>{rank == null ? '分位 —' : `${Math.round(rank)}%`}</small>
                  </div>
                </div>
                <div className="party-stats">
                  <div className="party-fund">
                    <span>
                      <small>市盈率</small>
                      <b>{formatRatio(quote.peTtm ?? quote.pe)}</b>
                    </span>
                    <span>
                      <small>市净率</small>
                      <b>{formatRatio(quote.pb)}</b>
                    </span>
                    <span>
                      <small>股息率</small>
                      <b>{formatPercent(quote.dividendYield)}</b>
                    </span>
                    <span>
                      <small>五年中位</small>
                      <b>{mid5y == null ? '—' : formatPrice(mid5y)}</b>
                    </span>
                  </div>
                  <div className={`party-pnl ${pos ? (pos.pnl >= 0 ? 'up' : 'down') : 'mute'}`}>
                    <small>持仓盈亏</small>
                    {pos ? (
                      <>
                        <strong>{formatSigned(pos.pnl)}</strong>
                        <small>{formatSigned(pos.pct)}%</small>
                      </>
                    ) : (
                      <small>未建仓</small>
                    )}
                  </div>
                </div>
              </button>
              {editing ? (
                <div className="party-ops">
                  <button onClick={() => moveParty(id, -1)}>上</button>
                  <button onClick={() => moveParty(id, 1)}>下</button>
                  <button
                    onClick={() => {
                      if (confirm(`放生 ${stock.name}？`)) {
                        release(id)
                        play(sfx.run)
                      }
                    }}
                  >
                    放
                  </button>
                </div>
              ) : null}
            </li>
          )
        })}
      </ol>
      {party.length === 0 ? (
        <p className="empty">这支队伍是空的。去草地里捉一只，或从图鉴编入。</p>
      ) : null}
    </div>
  )
}
