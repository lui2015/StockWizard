export type Sector =
  | 'tech'
  | 'consumer'
  | 'finance'
  | 'healthcare'
  | 'energy'
  | 'industrials'
  | 'property'
  | 'internet'
  | 'cyclical'
  | 'conglomerate'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'legendary'

export type SpriteShape = 'orb' | 'tall' | 'beast' | 'bird' | 'cube' | 'fish' | 'cat' | 'dragon'

export type Screen =
  | { name: 'title' }
  | { name: 'menu' }
  | { name: 'dex' }
  | { name: 'detail'; id: string; tab?: 'dex' | 'observe' | 'analyze' }
  | { name: 'grass' }
  | { name: 'party' }
  | { name: 'trainer' }
  | { name: 'settings' }

export interface StockSprite {
  id: string
  no: number
  code: string
  name: string
  market: 'US' | 'CN' | 'HK'
  types: [Sector] | [Sector, Sector]
  rarity: Rarity
  shape: SpriteShape
  category: string
  heightLabel: string
  weightLabel: string
  dexText: string
  habitat: string
  ability: string
  abilityDesc: string
  baseStats: {
    hp: number
    atk: number
    def: number
    spa: number
    spd: number
    spe: number
  }
  basePrice: number
  wildness: number
}

export interface Quote {
  price: number
  series: number[]
  open: number
  high?: number
  low?: number
  prevClose?: number
  live?: boolean
  updatedAt?: number
  pe?: number
  peTtm?: number
  peStatic?: number
  peDynamic?: number
  pb?: number
  marketCap?: number
  floatCap?: number
  turnover?: number
  volumeRatio?: number
  amplitude?: number
  amount?: number
  volume?: number
  industry?: string
  eps?: number
  netProfit?: number
  revenue?: number
  roe?: number
  netMargin?: number
  grossMargin?: number
  dividendYield?: number
}

export interface Holding {
  cost: number
  qty: number
}

export interface Squad {
  id: string
  name: string
  members: string[]
}

export interface SaveData {
  trainerName: string
  trainerId: string
  seen: string[]
  captured: string[]
  party: string[]
  squads: Squad[]
  activeSquadId: string
  catchAttempts: Record<string, number>
  holdings: Record<string, Holding>
  soundOn: boolean
  started: boolean
  discovered: StockSprite[]
}
