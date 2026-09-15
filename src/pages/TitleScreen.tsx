import { useEffect } from 'react'
import { STOCKS } from '../data/stocks'
import { PixelSprite } from '../components/PixelSprite'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

export function TitleScreen() {
  const { setScreen, play } = useGame()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') start()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const start = () => {
    play(sfx.select)
    setScreen({ name: 'party' })
  }

  return (
    <div className="title-screen" onClick={start} role="button" tabIndex={0}>
      <p className="title-soft">1996 / 红白图鉴版</p>
      <h1>
        <span>股票精灵</span>
        <small>STOCK WIZARD</small>
      </h1>
      <div className="title-parade">
        {STOCKS.slice(0, 8).map((s) => (
          <PixelSprite key={s.id} stock={s} size="md" bounce />
        ))}
      </div>
      <p className="press-start blink">PRESS START</p>
      <p className="title-hint">按 Enter 或点击屏幕 · 把股票当成精灵去捉</p>
    </div>
  )
}
