import { useMemo, useState } from 'react'
import { PixelSprite } from '../components/PixelSprite'
import { useGame } from '../store/gameStore'
import { bookOf, formatSigned, positionOf } from '../utils/holding'
import { changePct, formatPrice } from '../utils/quotes'
import { trainerTitle } from '../utils/stats'
import { sfx } from '../utils/sound'

export function TrainerCard() {
  const { save, catalog, quotes, getSprite, rename, setScreen, play, switchSquad } = useGame()
  const [name, setName] = useState(save.trainerName)
  const title = trainerTitle(save.captured.length, catalog.length)
  const priceOf = (id: string) => {
    try {
      return quotes[id]?.price || getSprite(id).basePrice
    } catch {
      return quotes[id]?.price || 0
    }
  }

  const holdIds = save.captured.filter((id) => save.holdings[id])
  const book = bookOf(holdIds, save.holdings, quotes, priceOf)
  const squadBooks = save.squads.map((squad) => ({
    squad,
    book: bookOf(
      squad.members.filter((id) => save.captured.includes(id)),
      save.holdings,
      quotes,
      priceOf,
    ),
  }))

  const watched = useMemo(() => [...new Set(save.captured)], [save.captured])

  const movers = watched
    .map((id) => {
      try {
        const stock = getSprite(id)
        const quote = quotes[id] ?? { price: stock.basePrice, open: stock.basePrice, series: [stock.basePrice] }
        return { id, stock, quote, pct: changePct(quote), held: Boolean(positionOf(save.holdings[id], quote)) }
      } catch {
        return null
      }
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row && row.quote.live))
    .sort((a, b) => b.pct - a.pct)

  const star = movers[0] ?? null
  const drag = movers.length > 1 ? movers[movers.length - 1] : null
  const tone = (n: number | null) => (n == null ? 'mute' : n >= 0 ? 'up' : 'down')

  return (
    <div className="panel trainer-panel">
      <header className="panel-head row">
        <h2>训练家证</h2>
        <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
          返回
        </button>
      </header>

      <div className="id-card slim">
        <div className="id-photo">
          <span className="hat" />
          <span className="body red" />
        </div>
        <dl>
          <div>
            <dt>姓名</dt>
            <dd>
              <input
                value={name}
                maxLength={6}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => {
                  rename(name)
                  play(sfx.blip)
                }}
              />
            </dd>
          </div>
          <div>
            <dt>ID / 称号</dt>
            <dd>
              No.{save.trainerId} · {title}
            </dd>
          </div>
        </dl>
      </div>

      <section className="book-card">
        <h3>组合总览</h3>
        {book.count === 0 ? (
          <p className="empty">还没有记仓。到观察页写下买入价和数量，这里会汇总盈亏。</p>
        ) : (
          <>
            <div className="book-grid">
              <div>
                <small>市值</small>
                <b>{book.market.toFixed(2)}</b>
              </div>
              <div>
                <small>成本</small>
                <b>{book.cost.toFixed(2)}</b>
              </div>
              <div className={tone(book.pct)}>
                <small>累计盈亏</small>
                <b>{formatSigned(book.pnl)}</b>
                <em>{book.pct == null ? '—' : `${formatSigned(book.pct)}%`}</em>
              </div>
              <div className={tone(book.dayPct)}>
                <small>今日浮动</small>
                <b>{formatSigned(book.dayPnl)}</b>
                <em>{book.dayPct == null ? '—' : `${formatSigned(book.dayPct)}%`}</em>
              </div>
            </div>
            <p className="book-meta">
              {book.count} 笔持仓 · {book.win} 盈 {book.lose} 亏
              {book.topId && book.topWeight != null ? (
                <>
                  {' · '}
                  最大仓 {getSprite(book.topId).name} {book.topWeight.toFixed(0)}%
                </>
              ) : null}
            </p>
          </>
        )}
      </section>

      <section className="book-card">
        <h3>各队伍</h3>
        <ul className="squad-books">
          {squadBooks.map(({ squad, book: row }) => (
            <li key={squad.id}>
              <button
                className={squad.id === save.activeSquadId ? 'on' : ''}
                onClick={() => {
                  switchSquad(squad.id)
                  play(sfx.select)
                  setScreen({ name: 'party' })
                }}
              >
                <span>
                  <b>{squad.name}</b>
                  <small>
                    {squad.members.length}/6
                    {row.count ? ` · ${row.count} 笔` : ' · 未建仓'}
                  </small>
                </span>
                <strong className={row.pct == null ? 'mute' : tone(row.pct)}>
                  {row.pct == null ? '—' : `${formatSigned(row.pct)}%`}
                  {row.count ? <em>{formatSigned(row.pnl)}</em> : null}
                </strong>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="book-card">
        <h3>当日观察</h3>
        {star ? (
          <div className="star-list">
            <button
              className="star-row"
              onClick={() => {
                play(sfx.select)
                setScreen({ name: 'detail', id: star.id, tab: 'observe' })
              }}
            >
              <PixelSprite stock={star.stock} size="sm" />
              <span>
                <b>明星 {star.stock.name}</b>
                <small>
                  {star.quote.live ? formatPrice(star.quote.price) : '——.—'}
                  {star.held ? ' · 持仓' : ' · 自选'}
                </small>
              </span>
              <strong className={tone(star.pct)}>{formatSigned(star.pct)}%</strong>
            </button>
            {drag && drag.id !== star.id ? (
              <button
                className="star-row"
                onClick={() => {
                  play(sfx.select)
                  setScreen({ name: 'detail', id: drag.id, tab: 'observe' })
                }}
              >
                <PixelSprite stock={drag.stock} size="sm" />
                <span>
                  <b>拖累 {drag.stock.name}</b>
                  <small>
                    {drag.quote.live ? formatPrice(drag.quote.price) : '——.—'}
                    {drag.held ? ' · 持仓' : ' · 自选'}
                  </small>
                </span>
                <strong className={tone(drag.pct)}>{formatSigned(drag.pct)}%</strong>
              </button>
            ) : null}
          </div>
        ) : (
          <p className="empty">捕捉或编入队伍后，这里会标出今日涨跌最显眼的一只。</p>
        )}
      </section>

      <div className="progress">
        <p>
          图鉴 {save.captured.length}/{catalog.length} · 遇见 {save.seen.length} · 队伍 {save.squads.length} 支
        </p>
        <div className="stat-track tall">
          <i style={{ width: `${(save.captured.length / catalog.length) * 100}%` }} />
        </div>
      </div>

      <p className="fine">实时行情仅供展示 · 不构成投资建议</p>
      <div className="actions">
        <button className="btn ghost" onClick={() => setScreen({ name: 'settings' })}>
          说明书
        </button>
      </div>
    </div>
  )
}
