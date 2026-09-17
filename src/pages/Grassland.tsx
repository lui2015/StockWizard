import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchLiveQuote, fetchMarketTape, type MarketHit } from '../api/eastmoney'
import { STOCKS } from '../data/stocks'
import { CatchFanfare } from '../components/CatchFanfare'
import { MarketTape } from '../components/MarketTape'
import { PixelSprite } from '../components/PixelSprite'
import { StockRadar } from '../components/StockRadar'
import { TypeBadge } from '../components/TypeBadge'
import { useGame } from '../store/gameStore'
import { observeNotes } from '../utils/observe'
import { quoteIdOf } from '../utils/quoteId'
import { fetchChart } from '../api/chart'
import { changePct, formatPrice, pricePercentile } from '../utils/quotes'
import { catchRate } from '../utils/stats'
import { sfx } from '../utils/sound'
import { quoteFromLive, spriteFromHit } from '../utils/wildStock'
import type { StockSprite } from '../data/types'

type Phase = 'walk' | 'flash' | 'battle' | 'ball' | 'caught' | 'result'

const PATCHES = [
  { id: 0, left: '8%', top: '44%' },
  { id: 1, left: '28%', top: '42%' },
  { id: 2, left: '48%', top: '40%' },
  { id: 3, left: '68%', top: '43%' },
  { id: 4, left: '86%', top: '41%' },
  { id: 5, left: '16%', top: '62%' },
  { id: 6, left: '38%', top: '64%' },
  { id: 7, left: '62%', top: '61%' },
  { id: 8, left: '82%', top: '66%' },
]

const DECOR = [
  { left: '3%', top: '52%' },
  { left: '20%', top: '50%' },
  { left: '36%', top: '48%' },
  { left: '58%', top: '51%' },
  { left: '76%', top: '49%' },
  { left: '93%', top: '53%' },
  { left: '6%', top: '74%' },
  { left: '24%', top: '78%' },
  { left: '44%', top: '76%' },
  { left: '70%', top: '78%' },
  { left: '90%', top: '74%' },
  { left: '12%', top: '38%' },
  { left: '54%', top: '36%' },
  { left: '80%', top: '37%' },
]

const HOME = { left: '50%', top: '78%' }

// 天气雨滴的确定性伪随机参数，避免每次渲染抖动
const RAINS = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 13) % 100}%`,
  delay: (((i * 17) % 100) / 100) * 1.2,
  dur: 0.8 + ((i * 29) % 50) / 100,
}))

type Weather = 'sun' | 'rain' | null

const FLAVOR = [
  '草沙沙响，什么也没有。',
  '拨晚了，精灵钻回去了。',
  '这丛草还是温的。',
  '远处红光一闪，又没了。',
]

export function Grassland() {
  const { save, quotes, catalog, setScreen, play, markSeen, tryCatch, registerStock, refreshQuote } = useGame()
  const [hits, setHits] = useState(0)
  const [hot, setHot] = useState<number | null>(null)
  const [rustle, setRustle] = useState<number | null>(null)
  const [hero, setHero] = useState({ ...HOME, face: 'right' as 'left' | 'right', pose: 'idle' })
  const [phase, setPhase] = useState<Phase>('walk')
  const [wild, setWild] = useState<StockSprite | null>(null)
  const [shakes, setShakes] = useState(0)
  const [result, setResult] = useState('')
  const [radar, setRadar] = useState(false)
  const [tape, setTape] = useState(false)
  const [look, setLook] = useState(0)
  const lookRef = useRef(0)
  const catchNoteRef = useRef('')
  const lockRef = useRef(false)
  const hotRef = useRef<number | null>(null)
  const phaseRef = useRef(phase)
  const [msg, setMsg] = useState('草丛会自己晃。点中晃着的那丛，或按拨草，才可能跳出精灵。')
  const [dayCloses, setDayCloses] = useState<number[]>([])
  const [weather, setWeather] = useState<Weather>(null)

  phaseRef.current = phase

  // 天气：A股/港股/美股代表指数全跌 → 下雨，全涨 → 阳光，其余维持原样
  useEffect(() => {
    let alive = true
    const pull = async () => {
      try {
        const rows = await fetchMarketTape()
        if (!alive) return
        const pick = (id: string) => rows.find((row) => row.id === id)?.pct
        const pcts = [pick('1.000001'), pick('100.HSI'), pick('100.DJIA')]
        if (pcts.some((p) => p == null)) {
          setWeather(null)
        } else if (pcts.every((p) => (p as number) < 0)) {
          setWeather('rain')
        } else if (pcts.every((p) => (p as number) > 0)) {
          setWeather('sun')
        } else {
          setWeather(null)
        }
      } catch {
        // 行情拿不到时保持当前天气
      }
    }
    void pull()
    const t = window.setInterval(pull, 60000)
    return () => {
      alive = false
      window.clearInterval(t)
    }
  }, [])
  hotRef.current = hot

  useEffect(() => {
    if (!wild) {
      setDayCloses([])
      return
    }
    let alive = true
    void fetchChart(wild, 'day')
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
  }, [wild?.id])

  const pool = useMemo(() => {
    const unseen = catalog.filter((s) => !save.captured.includes(s.id))
    return unseen.length ? unseen : catalog
  }, [catalog, save.captured])

  const beginEncounter = (pick: StockSprite, viaRadar: boolean) => {
    setRadar(false)
    setWild(pick)
    lookRef.current = 0
    setLook(0)
    setHot(null)
    setPhase('flash')
    play(sfx.encounter)
    void refreshQuote(pick.id)
    window.setTimeout(() => {
      markSeen(pick.id)
      setPhase('battle')
      if (save.captured.includes(pick.id)) {
        setMsg(`${pick.name} 的伙伴出现了！只能观察。`)
        return
      }
      setMsg(
        viaRadar
          ? `雷达锁定！野生的 ${pick.name}（${pick.code}）跳了出来！`
          : `野生的 ${pick.name} 跳了出来！`,
      )
    }, 420)
  }

  const strike = (id: number | null) => {
    if (phase !== 'walk' || lockRef.current) return
    if (id == null || id !== hotRef.current) {
      play(sfx.catchFail)
      setHero((h) => ({ ...h, pose: 'swipe' }))
      window.setTimeout(() => setHero((h) => ({ ...h, pose: 'idle' })), 260)
      setMsg(id == null ? '这会儿没有草在晃。等一等。' : '拨错了，那丛草没动静。')
      return
    }
    lockRef.current = true
    const patch = PATCHES.find((item) => item.id === id)
    const face = patch && Number.parseFloat(patch.left) < 50 ? 'left' : 'right'
    if (patch) {
      setHero({
        left: patch.left,
        top: patch.top,
        face,
        pose: 'walk',
      })
    }
    setRustle(id)
    setHot(null)
    setHits((n) => n + 1)
    play(sfx.blip)
    window.setTimeout(() => {
      setHero((h) => ({ ...h, pose: 'swipe' }))
      play(sfx.shake)
    }, 280)
    window.setTimeout(() => {
      setRustle(null)
      setHero((h) => ({ ...h, pose: 'idle' }))
      if (Math.random() < 0.48) {
        const pick = pool[Math.floor(Math.random() * pool.length)]
        beginEncounter(pick, false)
        return
      }
      setMsg(FLAVOR[Math.floor(Math.random() * FLAVOR.length)])
      setHero({ ...HOME, face: 'right', pose: 'walk' })
      window.setTimeout(() => {
        setHero((h) => ({ ...h, pose: 'idle' }))
        lockRef.current = false
      }, 300)
    }, 560)
  }

  useEffect(() => {
    if (phase !== 'walk') return
    lockRef.current = false
    const tick = () => {
      if (phaseRef.current !== 'walk' || lockRef.current) return
      setHot((prev) => {
        let next = Math.floor(Math.random() * PATCHES.length)
        while (next === prev) next = Math.floor(Math.random() * PATCHES.length)
        return next
      })
    }
    tick()
    const t = window.setInterval(tick, 1300)
    return () => window.clearInterval(t)
  }, [phase])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.isComposing) return
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      if (phaseRef.current !== 'walk') return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        strike(hotRef.current)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const pickFromRadar = async (hit: MarketHit) => {
    play(sfx.select)
    const live = await fetchLiveQuote(hit.quoteId).catch(() => null)
    const stock = spriteFromHit(hit, live?.price ?? 10)
    registerStock(stock, quoteFromLive(live, stock.basePrice))
    beginEncounter(stock, true)
  }

  const notes = wild ? observeNotes(wild, quotes[wild.id]) : []

  const observe = async () => {
    if (!wild) return
    play(sfx.select)
    markSeen(wild.id)
    const page = lookRef.current
    lookRef.current = page + 1
    setLook(lookRef.current)
    if (!quotes[wild.id]?.pe && !quotes[wild.id]?.pb) {
      setMsg('观察中……正在读取估值。')
    }
    const live = await fetchLiveQuote(quoteIdOf(wild)).catch(() => null)
    const quote = live
      ? {
          ...quoteFromLive(live, wild.basePrice),
          series:
            live.series.length > 2
              ? live.series
              : (quotes[wild.id]?.series ?? quoteFromLive(live, wild.basePrice).series),
        }
      : quotes[wild.id]
    if (quote) registerStock(wild, quote)
    const pages = observeNotes(wild, quote)
    if (page === lookRef.current - 1) setMsg(pages[page % pages.length])
  }

  const throwBall = () => {
    if (!wild || phase !== 'battle') return
    if (save.captured.includes(wild.id)) {
      setMsg(`${wild.name} 已经是你的伙伴了，球被礼貌地顶了回来。`)
      play(sfx.catchFail)
      return
    }
    play(sfx.shake)
    setPhase('ball')
    setShakes(0)
    const outcome = tryCatch(wild.id)
    const n = outcome.ok ? 3 : 1 + Math.floor(Math.random() * 2)
    let i = 0
    const tick = () => {
      i += 1
      setShakes(i)
      play(sfx.shake)
      if (i < n) {
        window.setTimeout(tick, 380)
        return
      }
      window.setTimeout(() => {
        if (outcome.ok) {
          catchNoteRef.current = outcome.toParty
            ? `好耶！${wild.name} 被捉住了！它加入了「${save.squads.find((s) => s.id === save.activeSquadId)?.name ?? '当前队伍'}」。`
            : `好耶！${wild.name} 被捉住了！「${save.squads.find((s) => s.id === save.activeSquadId)?.name ?? '当前队伍'}」已满，它先住进图鉴仓库。`
          setResult('ok')
          setMsg('球里闪过一道光……')
          setPhase('caught')
        } else {
          play(sfx.catchFail)
          setResult('fail')
          setPhase('battle')
          setMsg(`啊，差一点！${wild.name} 挣脱了！（成功率约 ${Math.round(outcome.rate * 100)}%）`)
        }
      }, 360)
    }
    window.setTimeout(tick, 280)
  }

  const finishCatch = useCallback(() => {
    setPhase('result')
    setMsg(catchNoteRef.current)
  }, [])

  const run = () => {
    play(sfx.run)
    lockRef.current = false
    setPhase('walk')
    setWild(null)
    lookRef.current = 0
    setLook(0)
    setResult('')
    catchNoteRef.current = ''
    setHero({ ...HOME, face: 'right', pose: 'idle' })
    setMsg('你回到草地中央。等草再晃起来。')
  }

  const rate = wild
    ? catchRate(
        wild,
        save.seen.includes(wild.id),
        save.catchAttempts[wild.id] ?? 0,
        quotes[wild.id],
      )
    : 0
  const wildQuote = wild
    ? (quotes[wild.id] ?? { price: wild.basePrice, open: wild.basePrice, series: [wild.basePrice] })
    : null
  const wildPct = wildQuote ? changePct(wildQuote) : 0
  const wildRank = wildQuote ? pricePercentile(wildQuote.price, dayCloses) : null

  if (radar) {
    return (
      <div className="panel grass-panel">
        <StockRadar onClose={() => setRadar(false)} onPick={pickFromRadar} />
      </div>
    )
  }

  if (tape) {
    return (
      <div className="panel grass-panel">
        <MarketTape onClose={() => setTape(false)} />
      </div>
    )
  }

  return (
    <div className="panel grass-panel">
      <header className="panel-head row">
        <div>
          <h2>野外草地</h2>
          <p>拨中 {hits} 丛 · 内置 {STOCKS.length} + 雷达 {save.discovered.length}</p>
        </div>
        <div className="head-ops">
          <button
            className="tiny"
            onClick={() => {
              play(sfx.blip)
              setTape(true)
            }}
          >
            大盘行情
          </button>
        </div>
      </header>

      <div
        className={`field hunt ${phase === 'flash' ? 'flash' : ''} ${phase === 'caught' ? 'caught' : ''} ${
          phase === 'battle' || phase === 'ball' || phase === 'result' ? 'battling' : ''
        } ${weather ? `weather-${weather}` : ''}`}
      >
        <span className="cloud puff c1"><i /><i /><i /></span>
        <span className="cloud puff c2"><i /><i /><i /></span>
        <span className="cloud puff c3"><i /><i /></span>
        <span className="cloud puff c4"><i /><i /><i /></span>
        <span className="cloud puff c5"><i /><i /></span>
        <i className="sun" />
        {weather === 'sun' ? (
          <div className="weather sunshine" aria-hidden>
            <span className="rays">
              {Array.from({ length: 8 }, (_, i) => (
                <i key={i} style={{ transform: `rotate(${i * 45}deg) translateY(-30px)` }} />
              ))}
            </span>
          </div>
        ) : null}
        {weather === 'rain' ? (
          <div className="weather rain" aria-hidden>
            {RAINS.map((drop, i) => (
              <i
                key={i}
                className="raindrop"
                style={{
                  left: drop.left,
                  animationDelay: `${drop.delay}s`,
                  animationDuration: `${drop.dur}s`,
                }}
              />
            ))}
          </div>
        ) : null}
        {phase === 'walk' || phase === 'flash'
          ? DECOR.map((item, i) => (
              <i key={`d-${i}`} className={`tuft decor ${i % 2 ? 'sway' : ''}`} style={{ left: item.left, top: item.top }} />
            ))
          : null}
        {phase === 'walk'
          ? PATCHES.map((patch) => (
              <button
                key={patch.id}
                type="button"
                className={`tuft patch ${hot === patch.id ? 'hot' : ''} ${rustle === patch.id ? 'rustle' : ''}`}
                style={{ left: patch.left, top: patch.top }}
                onClick={() => strike(patch.id)}
                aria-label={hot === patch.id ? '晃动的草' : '草丛'}
              />
            ))
          : null}
        {phase === 'walk' || phase === 'flash' ? (
          <div
            className={`hero ${hero.face} ${hero.pose}`}
            style={{ left: hero.left, top: hero.top }}
            aria-hidden
          >
            <i className="hero-cap" />
            <i className="hero-head" />
            <i className="hero-eye" />
            <i className="hero-coat" />
            <i className="hero-arm left" />
            <i className="hero-arm right" />
            <i className="hero-leg left" />
            <i className="hero-leg right" />
          </div>
        ) : null}

        {phase === 'caught' && wild ? (
          <CatchFanfare stock={wild} play={play} onDone={finishCatch} />
        ) : null}

        {(phase === 'battle' || phase === 'ball' || phase === 'result') && wild ? (
          <div className="battle">
            <div className={`wild-box ${phase === 'ball' ? 'in-ball' : ''} ${result === 'ok' ? 'caught-box' : ''}`}>
              <div className="wild-sprite">
                {phase === 'ball' ? (
                  <div className={`pokeball shake-${shakes}`}>
                    <i className="cap" />
                    <i className="btn" />
                  </div>
                ) : (
                  <PixelSprite stock={wild} size="lg" bounce={result !== 'ok'} />
                )}
              </div>
              <div className="wild-info">
                <p className="wild-name">
                  {wild.name}
                  <small>{wild.code}</small>
                </p>
                <p className={`wild-quote ${wildQuote?.live ? (wildPct >= 0 ? 'up' : 'down') : ''}`}>
                  {wildQuote?.live ? formatPrice(wildQuote.price) : '——.—'}
                  <small>
                    {wildQuote?.live
                      ? `${wildPct >= 0 ? '▲' : '▼'}${wildPct.toFixed(2)}%`
                      : '接入中'}
                  </small>
                </p>
                <div className="type-row compact">
                  {wild.types.map((t) => (
                    <TypeBadge key={t} type={t} />
                  ))}
                </div>
              </div>
              <div className="rank-row">
                <div className="hp-bar mini">
                  <i
                    style={{ width: `${wildRank ?? 0}%` }}
                    className={wildRank == null ? '' : wildRank >= 70 ? 'ok' : wildRank <= 30 ? 'low' : 'mid'}
                  />
                </div>
                <small>{wildRank == null ? '分位 —' : `${Math.round(wildRank)}%`}</small>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      <div className="msg-box">{msg}</div>

      {phase === 'walk' ? (
        <div className="actions">
          <button className="btn fat" onClick={() => strike(hot)}>
            拨草
          </button>
          <button
            className="btn ghost fat"
            onClick={() => {
              play(sfx.blip)
              setRadar(true)
            }}
          >
            精灵雷达
          </button>
        </div>
      ) : null}

      {phase === 'battle' && wild ? (
        <div className="actions battle-actions">
          <button className="btn" onClick={observe}>
            {look === 0 ? '观察' : `观察 ${((look - 1) % notes.length) + 1}/${notes.length}`}
          </button>
          <button className="btn" onClick={throwBall} disabled={save.captured.includes(wild.id)}>
            投球 {save.captured.includes(wild.id) ? '' : `${Math.round(rate * 100)}%`}
          </button>
          <button className="btn ghost" onClick={run}>
            逃跑
          </button>
        </div>
      ) : null}

      {phase === 'result' ? (
        <div className="actions">
          {wild && result === 'ok' ? (
            <button
              className="btn"
              onClick={() => setScreen({ name: 'detail', id: wild.id, tab: 'dex' })}
            >
              查看图鉴
            </button>
          ) : null}
          <button className="btn ghost" onClick={run}>
            继续拨草
          </button>
        </div>
      ) : null}
    </div>
  )
}
