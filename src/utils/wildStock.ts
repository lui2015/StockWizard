import { STOCKS } from '../data/stocks'
import type { Quote, Sector, SpriteShape, StockSprite } from '../data/types'
import type { MarketHit } from '../api/eastmoney'

const SHAPES: SpriteShape[] = ['orb', 'tall', 'beast', 'bird', 'cube', 'fish', 'cat', 'dragon']

function norm(code: string) {
  return code.toUpperCase().replace(/\.HK$/i, '').replace(/^0+/, '')
}

export function findBuiltin(hit: MarketHit) {
  return STOCKS.find((s) => s.market === hit.market && norm(s.code) === norm(hit.code))
}

export function inferTypes(name: string, market: 'CN' | 'HK'): StockSprite['types'] {
  const table: [RegExp, Sector][] = [
    [/银行|证券|保险|信托|金融/, 'finance'],
    [/酒|茅|食品|消费|零售|乳|茶/, 'consumer'],
    [/药|生物|医疗|健康/, 'healthcare'],
    [/石油|煤炭|燃气|能源|电力/, 'energy'],
    [/地产|置业|建设|水泥|基建/, 'property'],
    [/汽车|钢铁|机械|制造|工业|军工/, 'industrials'],
    [/芯片|半导体|电子|科技|通信|光电/, 'tech'],
    [/互联|传媒|游戏|软件|网络|影视/, 'internet'],
  ]
  const found = table.find(([re]) => re.test(name))?.[1]
  if (found) return market === 'HK' ? [found, 'internet'] : [found]
  return market === 'HK' ? ['internet'] : ['conglomerate']
}

/** FNV-1a：比简单求和更分散，避免不同股票撞造型 */
export function fnv1a(input: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

export function spriteFromHit(hit: MarketHit, price = 10): StockSprite {
  const builtin = findBuiltin(hit)
  if (builtin) return builtin
  const seed = fnv1a(`${hit.quoteId}|${hit.name}`)
  const types = inferTypes(hit.name, hit.market)
  return {
    id: hit.id,
    no: 100 + (seed % 800),
    code: hit.market === 'HK' ? `${hit.code}.HK` : hit.code,
    name: hit.name,
    market: hit.market,
    types,
    rarity: 'uncommon',
    shape: SHAPES[seed % SHAPES.length],
    category: hit.market === 'HK' ? '港股公司' : `${hit.board}公司`,
    heightLabel: hit.board,
    weightLabel: hit.market === 'HK' ? '港股现货' : 'A股现货',
    dexText: `${hit.name}（${hit.code}）在${hit.board}交易。雷达刚记下代码和市场，打开观察页看实时行情，分析页看所属行业的观察点。`,
    habitat: hit.board,
    ability: '代码锁定',
    abilityDesc: '先确认代码和市场，再决定要不要编入队伍。',
    baseStats: {
      hp: 62 + (seed % 20),
      atk: 58 + (seed % 24),
      def: 56 + (seed % 22),
      spa: 60 + (seed % 26),
      spd: 55 + (seed % 18),
      spe: 64 + (seed % 28),
    },
    basePrice: price,
    wildness: 26,
  }
}

export function quoteFromLive(
  live: {
    price: number
    open: number
    series: number[]
    high?: number
    low?: number
    prevClose?: number
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
  } | null,
  fallbackPrice: number,
): Quote {
  if (!live) {
    const price = fallbackPrice || 10
    return {
      price,
      open: price,
      series: Array.from({ length: 20 }, () => price),
      live: false,
    }
  }
  return {
    price: live.price,
    open: live.open || live.price,
    series: live.series.length ? live.series : Array.from({ length: 20 }, () => live.price),
    high: live.high,
    low: live.low,
    prevClose: live.prevClose,
    live: true,
    updatedAt: Date.now(),
    pe: live.pe,
    peTtm: live.peTtm,
    peStatic: live.peStatic,
    peDynamic: live.peDynamic,
    pb: live.pb,
    marketCap: live.marketCap,
    floatCap: live.floatCap,
    turnover: live.turnover,
    volumeRatio: live.volumeRatio,
    amplitude: live.amplitude,
    amount: live.amount,
    volume: live.volume,
    industry: live.industry,
    eps: live.eps,
    netProfit: live.netProfit,
    revenue: live.revenue,
    roe: live.roe,
    netMargin: live.netMargin,
    grossMargin: live.grossMargin,
    dividendYield: live.dividendYield,
  }
}
