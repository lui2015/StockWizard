import type { Sector } from './types'

export const SECTOR_META: Record<
  Sector,
  {
    name: string
    watch: string
    hint: string
    colors: [string, string, string, string]
  }
> = {
  tech: {
    name: '科技',
    watch: '利率和资本开支',
    hint: '估值跟创新叙事走，利率抬升时往往先被压一压。',
    colors: ['#1A1A1A', '#F7D51D', '#FFF1A8', '#C9A000'],
  },
  consumer: {
    name: '消费',
    watch: '居民口袋和旺季',
    hint: '跟必选/可选消费有关，节奏比题材股稳，但也怕需求降温。',
    colors: ['#1A1A1A', '#3B6FD6', '#8CB4FF', '#1D3F8A'],
  },
  finance: {
    name: '金融',
    watch: '利率与资产质量',
    hint: '吃息差和风险偏好，政策与坏账预期会直接改它的脾气。',
    colors: ['#1A1A1A', '#C65CDB', '#F0B7FF', '#7A268C'],
  },
  healthcare: {
    name: '医药',
    watch: '管线和政策',
    hint: '长得慢，一旦有数据或集采消息，叶子会忽然抖一下。',
    colors: ['#1A1A1A', '#3FA34D', '#A6E36A', '#1F6B2D'],
  },
  energy: {
    name: '能源',
    watch: '油价和产能',
    hint: '周期上行时很精神，油价回落就像天气突然转阴。',
    colors: ['#1A1A1A', '#DC0A2D', '#FF7A3D', '#8B0E22'],
  },
  industrials: {
    name: '制造',
    watch: '订单和开工',
    hint: '跟工厂、汽车、机械绑定，转身不快，但抗打。',
    colors: ['#1A1A1A', '#8A93A0', '#D5DAE2', '#4C5560'],
  },
  property: {
    name: '地产',
    watch: '信用和销售',
    hint: '身躯很重，融资环境和成交量一变，脚步就会乱。',
    colors: ['#1A1A1A', '#C4A36A', '#E8D3A4', '#6B5428'],
  },
  internet: {
    name: '互联网',
    watch: '流量和监管',
    hint: '广告与用户时长托着它，风停了就会急降。',
    colors: ['#1A1A1A', '#7EB6FF', '#D6ECFF', '#2F5F99'],
  },
  cyclical: {
    name: '周期',
    watch: '库存和预期',
    hint: '高弹性题材，兴奋时谁都看不清，回撤也快。',
    colors: ['#1A1A1A', '#5A3D7A', '#B08AD4', '#2A1838'],
  },
  conglomerate: {
    name: '综合',
    watch: '折价和分红',
    hint: '业务很杂，很少走极端，适合当压舱观察。',
    colors: ['#1A1A1A', '#C8C2B4', '#F4F0E6', '#6F6A60'],
  },
}

export const ALL_SECTORS = Object.keys(SECTOR_META) as Sector[]

const LEGACY: Record<string, Sector> = {
  electric: 'tech',
  fire: 'energy',
  water: 'consumer',
  grass: 'healthcare',
  steel: 'industrials',
  psychic: 'finance',
  flying: 'internet',
  rock: 'property',
  dark: 'cyclical',
  normal: 'conglomerate',
}

export function migrateSector(value: string): Sector {
  if (value in SECTOR_META) return value as Sector
  return LEGACY[value] ?? 'conglomerate'
}
