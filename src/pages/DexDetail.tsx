import { DialogBox } from '../components/DialogBox'
import { PixelSprite } from '../components/PixelSprite'
import { PriceChart } from '../components/PriceChart'
import { ProfitChart } from '../components/ProfitChart'
import { HoldingPanel } from '../components/HoldingPanel'
import { MetricList } from '../components/MetricList'
import { TypeBadge } from '../components/TypeBadge'
import { useEffect, useState } from 'react'
import { fetchChart } from '../api/chart'
import { useGame } from '../store/gameStore'
import { moveLog } from '../utils/moves'
import { listingOf, quoteIdOf } from '../utils/quoteId'
import { changePct, dayRange, formatPrice, formatTime, percentileNote, pricePercentile } from '../utils/quotes'
import { levelOf, rarityLabel } from '../utils/stats'
import { sfx } from '../utils/sound'

export function DexDetail({ id, tab = 'dex' }: { id: string; tab?: 'dex' | 'observe' | 'analyze' }) {
  const {
    save,
    quotes,
    getSprite,
    setScreen,
    play,
    moveToSquad,
    leaveParty,
    release,
    refreshQuote,
    setHolding,
  } = useGame()
  const stock = getSprite(id)
  const quote = quotes[id] ?? { price: stock.basePrice, open: stock.basePrice, series: [stock.basePrice] }
  const seen = save.seen.includes(id)
  const caught = save.captured.includes(id)
  const homes = save.squads.filter((s) => s.members.includes(id))
  const [picking, setPicking] = useState(false)
  const pct = changePct(quote)
  const range = dayRange(quote)
  const [dayCloses, setDayCloses] = useState<number[]>([])
  const rank = pricePercentile(quote.price, dayCloses)

  useEffect(() => {
    if (!seen) return
    void refreshQuote(id)
    const t = window.setInterval(() => {
      void refreshQuote(id)
    }, 10000)
    return () => window.clearInterval(t)
  }, [id, seen, refreshQuote])

  useEffect(() => {
    if (!seen || tab !== 'observe') return
    let alive = true
    void fetchChart(stock, 'day')
      .then((bars) => {
        if (!alive) return
        setDayCloses(bars.map((bar) => bar.close).filter((n) => n > 0))
      })
      .catch(() => {
        if (alive) setDayCloses([])
      })
    return () => {
      alive = false
    }
  }, [seen, tab, stock.id, stock.code, stock.market])

  const go = (next: typeof tab) => {
    play(sfx.blip)
    setScreen({ name: 'detail', id, tab: next })
  }

  return (
    <div className="panel detail-panel">
      <header className="panel-head row">
        <button className="tiny" onClick={() => setScreen({ name: 'dex' })}>
          图鉴
        </button>
        <h2>
          No.{String(stock.no).padStart(2, '0')} {seen ? stock.name : '?????'}
        </h2>
        <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
          菜单
        </button>
      </header>

      <div className="tabs">
        {(['dex', 'observe', 'analyze'] as const).map((t) => (
          <button key={t} className={tab === t ? 'on' : ''} onClick={() => go(t)}>
            {t === 'dex' ? '图鉴' : t === 'observe' ? '观察' : '分析'}
          </button>
        ))}
      </div>

      {tab === 'dex' ? (
        <section className="detail-body">
          <div className="portrait">
            <PixelSprite stock={stock} size="xl" silhouette={!seen} bounce={seen} />
            {caught ? <i className="ball caught big" /> : null}
          </div>
          {seen ? (
            <>
              <p className="code-line">
                {stock.code} · {stock.market} · {rarityLabel(stock.rarity)}
              </p>
              <div className="type-row">
                {stock.types.map((t) => (
                  <TypeBadge key={t} type={t} />
                ))}
                <span className="level-tag">Lv.{levelOf(stock, quote)}</span>
              </div>
              <p className="meta">
                行业 {stock.category}
                <br />
                上市 {listingOf(stock)} · {stock.heightLabel}
                <br />
                业务 {stock.weightLabel}
              </p>
              <DialogBox speaker="公司档案" text={stock.dexText} />
              <p className="ability">
                观察要点「{stock.ability}」：{stock.abilityDesc}
              </p>
              <div className="actions">
                {caught ? (
                  <button
                    className="btn"
                    onClick={() => {
                      setPicking((v) => !v)
                      play(sfx.blip)
                    }}
                  >
                    {homes.length === 0
                      ? '所属队伍'
                      : homes.length === 1
                        ? `所属：${homes[0].name}`
                        : `所属：${homes[0].name}等`}
                  </button>
                ) : null}
                {caught ? (
                  <button
                    className="btn ghost"
                    onClick={() => {
                      if (confirm(`要把 ${stock.name} 放生吗？图鉴会保留遇见记录。`)) {
                        release(id)
                        play(sfx.run)
                      }
                    }}
                  >
                    放生
                  </button>
                ) : (
                  <button className="btn" onClick={() => setScreen({ name: 'grass' })}>
                    去草地找它
                  </button>
                )}
              </div>
              {caught && picking ? (
                <div className="squad-pick">
                  <p>换到哪支队伍？每队最多 6 只。</p>
                  {save.squads.map((item) => {
                    const here = item.members.includes(id)
                    const full = !here && item.members.length >= 6
                    return (
                      <button
                        key={item.id}
                        className={here ? 'on' : ''}
                        disabled={full}
                        onClick={() => {
                          if (here && homes.length === 1) {
                            setPicking(false)
                            return
                          }
                          const ok = moveToSquad(id, item.id)
                          play(ok ? sfx.select : sfx.catchFail)
                          if (ok) setPicking(false)
                        }}
                      >
                        {item.name}
                        {full ? ' · 已满' : here ? ' · 当前' : ` · ${item.members.length}/6`}
                      </button>
                    )
                  })}
                  {homes.length > 0 ? (
                    <button
                      className="ghost"
                      onClick={() => {
                        leaveParty(id)
                        play(sfx.run)
                        setPicking(false)
                      }}
                    >
                      移出队伍
                    </button>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <p className="empty">还没遇见这只精灵。到草地里走走看。</p>
          )}
        </section>
      ) : null}

      {tab === 'observe' ? (
        <section className="detail-body">
          {!seen ? (
            <p className="empty">未见过的精灵无法观察。</p>
          ) : (
            <>
              <div className="quote-strip">
                <strong>{quote.live ? formatPrice(quote.price) : '——.—'}</strong>
                {quote.live ? (
                  <em className={pct >= 0 ? 'up' : 'down'}>
                    {pct >= 0 ? '▲' : '▼'} {pct.toFixed(2)}%
                  </em>
                ) : (
                  <em>接入中</em>
                )}
                <small>
                  {quote.live
                    ? `高 ${formatPrice(range.high)} / 低 ${formatPrice(range.low)}`
                    : '高 —— / 低 ——'}
                </small>
              </div>
              <p className="demo-tag">
                {quote.live
                  ? `实时行情${quote.updatedAt ? ` · ${formatTime(quote.updatedAt)}` : ''}`
                  : '正在接入实时行情…'}
              </p>
              <HoldingPanel
                holding={save.holdings[id]}
                quote={quote}
                onSave={(next) => {
                  play(sfx.select)
                  setHolding(id, next)
                }}
                onClear={() => {
                  play(sfx.run)
                  setHolding(id, null)
                }}
              />
              <PriceChart stock={stock} quote={quote} />
              <div className="hp-wrap">
                <span>历史分位</span>
                <div className="hp-bar">
                  <i
                    style={{ width: `${rank ?? 0}%` }}
                    className={rank == null ? '' : rank >= 70 ? 'ok' : rank <= 30 ? 'low' : 'mid'}
                  />
                </div>
                <b>{rank == null ? '—%' : `${Math.round(rank)}%`}</b>
              </div>
              <p className="habit">{percentileNote(stock.name, rank, dayCloses.length)}</p>
              <h3>行情日志</h3>
              <ul className="moves">
                {moveLog(stock, quote).map((m, idx) => (
                  <li key={`${m.name}-${idx}`}>
                    <b>{m.name}</b>
                    <span className={m.power >= 0 ? 'up' : 'down'}>{m.text}</span>
                  </li>
                ))}
                {moveLog(stock, quote).length === 0 ? <li>今日几乎没有明显波动，它在横盘休息。</li> : null}
              </ul>
            </>
          )}
        </section>
      ) : null}

      {tab === 'analyze' ? (
        <section className="detail-body">
          {!seen ? (
            <p className="empty">未见过的精灵无法分析。</p>
          ) : (
            <>
              {quote.live ? (
                <MetricList quote={quote} />
              ) : (
                <p className="empty">正在接入市盈率、市净率等分析指标…</p>
              )}
              <ProfitChart quoteId={quoteIdOf(stock)} />
            </>
          )}
        </section>
      ) : null}
    </div>
  )
}
