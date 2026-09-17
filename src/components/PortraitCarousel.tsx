import { useEffect, useRef, useState } from 'react'
import { SECTOR_META } from '../data/sectors'
import { PixelSprite } from './PixelSprite'
import type { StockSprite } from '../data/types'
import { listingOf } from '../utils/quoteId'

const SLIDES = 3

/**
 * 图鉴页顶部轮播：肖像 → 基本信息 → 分析档案
 * 支持手势滑动、指示点点击与自动轮播，切换带丝滑位移动画。
 */
export function PortraitCarousel({
  stock,
  seen,
  caught,
}: {
  stock: StockSprite
  seen: boolean
  caught: boolean
}) {
  const [page, setPage] = useState(0)
  const [drag, setDrag] = useState(0)
  const startX = useRef<number | null>(null)
  const dragRef = useRef(0)

  useEffect(() => {
    setPage(0)
    setDrag(0)
  }, [stock.id])

  // 自动轮播：每次切页后重新计时
  useEffect(() => {
    const t = window.setTimeout(() => setPage((p) => (p + 1) % SLIDES), 5000)
    return () => window.clearTimeout(t)
  }, [page, stock.id])

  const goTo = (p: number) => setPage(((p % SLIDES) + SLIDES) % SLIDES)

  const onDown = (e: React.PointerEvent) => {
    startX.current = e.clientX
    dragRef.current = 0
  }
  const onMove = (e: React.PointerEvent) => {
    if (startX.current == null) return
    dragRef.current = e.clientX - startX.current
    setDrag(dragRef.current)
  }
  const onUp = () => {
    if (startX.current == null) return
    if (dragRef.current < -40) goTo(page + 1)
    else if (dragRef.current > 40) goTo(page - 1)
    startX.current = null
    dragRef.current = 0
    setDrag(0)
  }

  return (
    <div
      className="portrait-carousel"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerLeave={onUp}
    >
      <div className="carousel-viewport">
        <div
          className="carousel-track"
          style={{
            transform: `translateX(calc(${-page * 100}% + ${drag}px))`,
            transition: startX.current == null ? 'transform 0.45s cubic-bezier(0.22, 0.61, 0.36, 1)' : 'none',
          }}
        >
          <div className="carousel-slide">
            <div className="portrait">
              <PixelSprite stock={stock} size="xl" silhouette={!seen} bounce={seen} />
              {caught ? <i className="ball caught big" /> : null}
            </div>
          </div>
          <div className="carousel-slide slide-card">
            <b className="slide-tag">基本信息</b>
            <ul className="slide-list">
              <li>
                <span>行业</span>
                <b>{stock.category}</b>
              </li>
              <li>
                <span>上市</span>
                <b>{listingOf(stock)}</b>
              </li>
              <li>
                <span>定位</span>
                <b>{stock.heightLabel}</b>
              </li>
              <li>
                <span>业务</span>
                <b>{stock.weightLabel}</b>
              </li>
              <li>
                <span>类型</span>
                <b>{stock.types.map((t) => SECTOR_META[t].name).join(' / ')}</b>
              </li>
            </ul>
          </div>
          <div className="carousel-slide slide-card">
            <b className="slide-tag">分析档案</b>
            <p className="slide-text">{stock.dexText}</p>
            <p className="slide-text ability">
              观察要点「{stock.ability}」：{stock.abilityDesc}
            </p>
          </div>
        </div>
      </div>
      <div className="carousel-dots">
        {Array.from({ length: SLIDES }, (_, i) => (
          <i key={i} className={i === page ? 'on' : ''} onClick={() => goTo(i)} />
        ))}
      </div>
    </div>
  )
}
