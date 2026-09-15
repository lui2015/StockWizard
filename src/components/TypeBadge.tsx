import { SECTOR_META } from '../data/sectors'
import type { Sector } from '../data/types'

export function TypeBadge({ type }: { type: Sector }) {
  const meta = SECTOR_META[type]
  return (
    <span className={`type-badge type-${type}`} style={{ background: meta.colors[1], color: meta.colors[0] }}>
      {meta.name}
    </span>
  )
}
