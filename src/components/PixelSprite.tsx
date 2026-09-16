import { SECTOR_META } from '../data/sectors'
import { STOCKS } from '../data/stocks'
import { LEAF, SHAPES } from '../data/sprites'
import type { StockSprite } from '../data/types'
import { fnv1a } from '../utils/wildStock'

const SIZE: Record<string, number> = { sm: 4, md: 6, lg: 8, xl: 12 }

const BUILTIN_IDS = new Set(STOCKS.map((s) => s.id))

const SHAPE_KEYS = Object.keys(SHAPES) as Array<keyof typeof SHAPES>

/** xorshift 随机数：由 seed 确定性生成，同一股票每次渲染结果一致 */
function makeRand(seed: number) {
  let h = (seed || 1) >>> 0
  return () => {
    h ^= h << 13
    h >>>= 0
    h ^= h >>> 17
    h ^= h << 5
    h >>>= 0
    return h / 0xffffffff
  }
}

/**
 * 在基础造型上做确定性变异：镜像、轮廓凿角、边缘凸起。
 * 只动轮廓(1)与空位(0)，不碰高光/花纹(2/3/4)，保证表情不变形。
 */
function mutateGrid(grid: readonly (readonly number[])[], seed: number): number[][] {
  const rand = makeRand(seed)
  const H = grid.length
  const at = (g: readonly (readonly number[])[], x: number, y: number) =>
    y >= 0 && y < H && x >= 0 && x < g[y].length ? g[y][x] : 0
  const flipped = rand() > 0.5

  // 第一遍：镜像 + 轮廓凿角
  let out = grid.map((row, y) =>
    row.map((_cell, x) => {
      const sx = flipped ? row.length - 1 - x : x
      const src = row[sx]
      if (src !== 1) return src
      const nearEmpty =
        !at(grid, sx - 1, y) || !at(grid, sx + 1, y) || !at(grid, sx, y - 1) || !at(grid, sx, y + 1)
      if (nearEmpty && rand() > 0.7) return 0
      return src
    }),
  )

  // 第二遍：边缘凸起
  out = out.map((row, y) =>
    row.map((cell, x) => {
      if (cell !== 0) return cell
      const nearFill =
        at(out, x - 1, y) !== 0 ||
        at(out, x + 1, y) !== 0 ||
        at(out, x, y - 1) !== 0 ||
        at(out, x, y + 1) !== 0
      return nearFill && rand() > 0.84 ? 1 : 0
    }),
  )
  return out
}

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
  // 非内置股票：渲染时按 id 确定性生成变异造型，保证每只独一无二（不依赖存档里的旧数据）
  const grid = BUILTIN_IDS.has(stock.id)
    ? (SHAPES[stock.shape] ?? SHAPES.orb)
    : mutateGrid(
        SHAPES[SHAPE_KEYS[fnv1a(stock.id + '|base') % SHAPE_KEYS.length]] ?? SHAPES.orb,
        fnv1a(stock.id + '|mut'),
      )
  const palette = (SECTOR_META[stock.types?.[0]] ?? SECTOR_META.conglomerate).colors
  const second = stock.types[1] && SECTOR_META[stock.types[1]] ? SECTOR_META[stock.types[1]].colors : palette
  const px = SIZE[size]
  const w = Math.max(...grid.map((r) => r.length))
  const h = grid.length + (stock.id === 'aapl' || stock.id === 'moutai' ? 3 : 0)
  const colors = silhouette
    ? ['transparent', '#1A1A1A', '#1A1A1A', '#2A2A2A', '#111']
    : ['transparent', palette[0], palette[1], palette[2], second[1]]

  const yOff = stock.id === 'aapl' || stock.id === 'moutai' ? 3 : 0

  // 非内置股票按 id 做色相偏移，避免同行业头像完全一样
  const hue = BUILTIN_IDS.has(stock.id)
    ? 0
    : (fnv1a(stock.id) % 71) - 35

  return (
    <div
      className={`sprite ${bounce ? 'sprite-bounce' : ''}`}
      style={{
        width: w * px,
        height: h * px,
        filter: hue ? `hue-rotate(${hue}deg)` : undefined,
      }}
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
