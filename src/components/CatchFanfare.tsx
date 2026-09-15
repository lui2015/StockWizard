import { useEffect, useRef, useState } from 'react'
import type { StockSprite } from '../data/types'
import { sfx } from '../utils/sound'
import { PixelSprite } from './PixelSprite'

const STARS = [0, 45, 90, 135, 180, 225, 270, 315]
const BITS = [
  { x: 8, d: 0, c: '#f7d51d' },
  { x: 18, d: 80, c: '#dc0a2d' },
  { x: 28, d: 40, c: '#fff' },
  { x: 40, d: 120, c: '#f7d51d' },
  { x: 52, d: 20, c: '#dc0a2d' },
  { x: 64, d: 90, c: '#fff' },
  { x: 74, d: 50, c: '#f7d51d' },
  { x: 86, d: 140, c: '#dc0a2d' },
  { x: 12, d: 180, c: '#fff' },
  { x: 46, d: 210, c: '#f7d51d' },
  { x: 70, d: 160, c: '#fff' },
  { x: 92, d: 200, c: '#dc0a2d' },
]

export function CatchFanfare({
  stock,
  play,
  onDone,
}: {
  stock: StockSprite
  play: (fn: () => void) => void
  onDone: () => void
}) {
  const [beat, setBeat] = useState(0)
  const playRef = useRef(play)
  const doneRef = useRef(onDone)
  playRef.current = play
  doneRef.current = onDone

  useEffect(() => {
    playRef.current(sfx.catchClick)
    const t1 = window.setTimeout(() => {
      setBeat(1)
      playRef.current(sfx.catchOk)
    }, 360)
    const t2 = window.setTimeout(() => {
      setBeat(2)
      playRef.current(sfx.catchFanfare)
    }, 820)
    const t3 = window.setTimeout(() => setBeat(3), 1180)
    const t4 = window.setTimeout(() => doneRef.current(), 2400)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
      window.clearTimeout(t4)
    }
  }, [])

  return (
    <div className={`catch-fanfare beat-${beat}`}>
      <div className="catch-rays" />
      <div className="catch-flash" />
      {BITS.map((bit, i) => (
        <i
          key={`bit-${i}`}
          className="catch-bit"
          style={{
            left: `${bit.x}%`,
            background: bit.c,
            animationDelay: `${bit.d}ms`,
          }}
        />
      ))}
      {beat >= 1
        ? STARS.map((deg) => (
            <i key={deg} className="catch-star" style={{ ['--deg' as string]: `${deg}deg` }} />
          ))
        : null}
      <div className="catch-core">
        {beat < 3 ? (
          <div className={`pokeball catch-ball ${beat >= 1 ? 'locked' : ''}`}>
            <i className="cap" />
            <i className="btn" />
          </div>
        ) : (
          <div className="catch-pop">
            <PixelSprite stock={stock} size="lg" />
          </div>
        )}
        {beat >= 2 ? <b className="catch-stamp">捉住了！</b> : null}
      </div>
    </div>
  )
}
