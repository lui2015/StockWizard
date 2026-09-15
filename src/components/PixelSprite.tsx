import { SECTOR_META } from '../data/sectors'
import { LEAF, SHAPES } from '../data/sprites'
import type { StockSprite } from '../data/types'

const SIZE: Record<string, number> = { sm: 4, md: 6, lg: 8, xl: 12 }

export function PixelSprite({
  stock,
  size = 'md',
  silhouette = false,
  bounce = false,
}: {
  stock: StockSprite
  size?: keyof typeof SIZE
  silhouette?: boolean
  bounce?: boolean
}) {
  const grid = SHAPES[stock.shape] ?? SHAPES.orb
  const palette = (SECTOR_META[stock.types?.[0]] ?? SECTOR_META.conglomerate).colors
  const second = stock.types[1] && SECTOR_META[stock.types[1]] ? SECTOR_META[stock.types[1]].colors : palette
  const px = SIZE[size]
  const w = Math.max(...grid.map((r) => r.length))
  const h = grid.length + (stock.id === 'aapl' || stock.id === 'moutai' ? 3 : 0)
  const colors = silhouette
    ? ['transparent', '#1A1A1A', '#1A1A1A', '#2A2A2A', '#111']
    : ['transparent', palette[0], palette[1], palette[2], second[1]]

  const yOff = stock.id === 'aapl' || stock.id === 'moutai' ? 3 : 0

  return (
    <div
      className={`sprite ${bounce ? 'sprite-bounce' : ''}`}
      style={{ width: w * px, height: h * px }}
      aria-hidden
    >
      {(stock.id === 'aapl' || stock.id === 'moutai') &&
        LEAF.map((row, y) =>
          row.map((cell, x) =>
            cell === 0 ? null : (
              <i
                key={`l-${x}-${y}`}
                style={{
                  left: (x + 6) * px,
                  top: y * px,
                  width: px,
                  height: px,
                  background: silhouette ? '#1A1A1A' : cell === 4 ? '#3FA34D' : '#1A1A1A',
                }}
              />
            ),
          ),
        )}
      {grid.map((row, y) =>
        row.map((cell, x) =>
          cell === 0 ? null : (
            <i
              key={`${x}-${y}`}
              style={{
                left: x * px,
                top: (y + yOff) * px,
                width: px,
                height: px,
                background: colors[cell],
              }}
            />
          ),
        ),
      )}
    </div>
  )
}
