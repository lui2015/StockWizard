import { useEffect, useState } from 'react'
import { fetchMarketTape, type TapeIndex } from '../api/eastmoney'
import { useGame } from '../store/gameStore'
import { bookOf, formatSigned } from '../utils/holding'
import { changePct, formatPrice } from '../utils/quotes'
import { todayStr, trainerTitle } from '../utils/stats'
import { sfx } from '../utils/sound'

const INDEX_GUESSES: { secid: string; name: string; note: string }[] = [
  { secid: '1.000001', name: '上证指数', note: 'A股大盘' },
  { secid: '100.HSI', name: '恒生指数', note: '港股大盘' },
]

export function GuessView() {
  const { save, quotes, catalog, getSprite, addGuess, play, setScreen } = useGame()
  const [tape, setTape] = useState<TapeIndex[]>([])
  const [tapeErr, setTapeErr] = useState(false)

  useEffect(() => {
    let alive = true
    fetchMarketTape()
      .then((rows) => {
        if (alive) setTape(rows)
      })
      .catch(() => {
        if (alive) setTapeErr(true)
      })
    return () => {
      alive = false
    }
  }, [])

  const today = todayStr()
  const todayGuesses = (save.guesses ?? []).filter((g) => g.date === today && !g.resolved)

  const resolved = (save.guesses ?? []).filter((g) => g.resolved)
  const hits = resolved.filter((g) => g.correct).length
  const hitRate = resolved.length ? (hits / resolved.length) * 100 : null

  const priceOf = (id: string) => {
    try {
      return quotes[id]?.price || getSprite(id).basePrice
    } catch {
      return quotes[id]?.price || 0
    }
  }
  const holdIds = save.captured.filter((id) => save.holdings[id])
  const book = bookOf(holdIds, save.holdings, quotes, priceOf)
  const title = trainerTitle(
    book.count > 0 ? book.pct : null,
    save.captured.length,
    catalog.length,
    hitRate,
  )

  const guess = (target: string, label: string, dir: 'up' | 'down') => {
    const ok = addGuess(target, label, dir)
    play(ok ? sfx.select : sfx.catchFail)
  }

  const renderPick = (target: string, label: string) => {
    const picked = todayGuesses.find((g) => g.target === target)
    if (!picked) {
      return (
        <div className="guess-ops">
          <button className="btn tiny up" onClick={() => guess(target, label, 'up')}>
            看涨 ▲
          </button>
          <button className="btn tiny down" onClick={() => guess(target, label, 'down')}>
            看跌 ▼
          </button>
        </div>
      )
    }
    return (
      <span className={`guess-picked ${picked.guess}`}>
        {picked.guess === 'up' ? '已猜 看涨 ▲' : '已猜 看跌 ▼'}
      </span>
    )
  }

  const history = (save.guesses ?? []).slice(0, 12)

  return (
    <div className="panel guess-panel">
      <header className="panel-head row">
        <div>
          <h2>猜涨跌</h2>
          <p>预测明天 A股 / 港股大盘与持仓的涨跌</p>
        </div>
        <div className="head-ops">
          <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
            返回
          </button>
        </div>
      </header>

      <section className="guess-stats">
        <div className="guess-stat">
          <small>预测命中率</small>
          <b>{hitRate == null ? '—' : `${hitRate.toFixed(0)}%`}</b>
          <small>{resolved.length ? `${hits}/${resolved.length} 命中` : '暂无结算记录'}</small>
        </div>
        <div className="guess-stat">
          <small>持仓收益率</small>
          <b className={book.count > 0 ? (book.pnl >= 0 ? 'up' : 'down') : ''}>
            {book.count > 0 && book.pct != null ? `${formatSigned(book.pct)}%` : '—'}
          </b>
          <small>{book.count > 0 ? `${book.count} 只持仓` : '未建仓'}</small>
        </div>
        <div className="guess-stat">
          <small>训练家称号</small>
          <b>{title}</b>
          <small>命中率 + 收益率 共同决定</small>
        </div>
      </section>

      <h3>猜大盘（第二天涨跌）</h3>
      {tapeErr ? <p className="fine">大盘行情连不上，稍后再试。</p> : null}
      <ul className="guess-list">
        {INDEX_GUESSES.map((item) => {
          const row = tape.find((r) => r.id === item.secid)
          return (
            <li key={item.secid} className="guess-item">
              <div className="guess-info">
                <b>
                  {item.name} <small>{item.note}</small>
                </b>
                <small>
                  {row
                    ? `${formatPrice(row.price)} · 今日 ${formatSigned(row.pct)}%`
                    : '行情读取中…'}
                </small>
              </div>
              {renderPick(`index:${item.secid}`, item.name)}
            </li>
          )
        })}
      </ul>

      <h3>猜持仓（第二天涨跌）</h3>
      {holdIds.length === 0 ? (
        <p className="fine">还没有持仓，先在图鉴里给精灵记录买入成本。</p>
      ) : (
        <ul className="guess-list">
          {holdIds.map((id) => {
            const stock = getSprite(id)
            const quote = quotes[id] ?? {
              price: stock.basePrice,
              open: stock.basePrice,
              series: [stock.basePrice],
            }
            return (
              <li key={id} className="guess-item">
                <div className="guess-info">
                  <b>{stock.name}</b>
                  <small>
                    {quote.live
                      ? `${formatPrice(quote.price)} · 今日 ${formatSigned(changePct(quote))}%`
                      : '行情未接入'}
                  </small>
                </div>
                {quote.live ? renderPick(id, stock.name) : <span className="guess-picked">—</span>}
              </li>
            )
          })}
        </ul>
      )}

      <h3>预测记录</h3>
      {history.length === 0 ? (
        <p className="fine">还没有预测记录，猜一把试试手气。</p>
      ) : (
        <ul className="guess-history">
          {history.map((g) => (
            <li key={g.id}>
              <b>{g.label}</b>
              <span>
                {g.date} · {g.guess === 'up' ? '看涨' : '看跌'}
              </span>
              {g.resolved ? (
                <em className={g.correct ? 'up' : 'down'}>
                  {g.correct ? '✓ 命中' : '✗ 未中'}（实际 {formatSigned(g.change ?? 0)}%）
                </em>
              ) : (
                <em>待结算</em>
              )}
            </li>
          ))}
        </ul>
      )}

      <p className="fine">
        结算规则：以你下一次打开应用当天的实际涨跌结算（看涨 = 涨幅 ≥ 0 算命中）。训练家称号由持仓收益率与猜涨跌命中率共同决定，命中率每高于
        50% 十个百分点，等效 +1% 收益。
      </p>
    </div>
  )
}
