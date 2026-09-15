import type { StockSprite } from '../data/types'

const US_IDS: Record<string, string> = {
  AAPL: '105.AAPL',
  MSFT: '105.MSFT',
  NVDA: '105.NVDA',
  TSLA: '105.TSLA',
  GOOGL: '105.GOOGL',
  AMZN: '105.AMZN',
  META: '105.META',
  BABA: '106.BABA',
  JPM: '106.JPM',
  XOM: '106.XOM',
  LLY: '106.LLY',
  CAT: '106.CAT',
  'BRK.B': '106.BRK',
  AMD: '105.AMD',
}

export function listingOf(stock: Pick<StockSprite, 'code' | 'market'>) {
  if (stock.market === 'US') return '美股'
  if (stock.market === 'HK') return '港股'
  const code = stock.code.replace(/\.HK$/i, '')
  if (code.startsWith('6') || code.startsWith('9')) return '沪A'
  if (code.startsWith('8') || code.startsWith('4')) return '京A'
  return '深A'
}

export function klineSymbolOf(stock: Pick<StockSprite, 'code' | 'market'>) {
  if (stock.market === 'HK') {
    return `hk${stock.code.replace(/\.HK$/i, '').padStart(5, '0')}`
  }
  if (stock.market === 'US') return `us${stock.code}`
  const code = stock.code.replace(/\.HK$/i, '')
  if (code.startsWith('6') || code.startsWith('9')) return `sh${code}`
  if (code.startsWith('8') || code.startsWith('4')) return `bj${code}`
  return `sz${code}`
}

export function quoteIdOf(stock: Pick<StockSprite, 'id' | 'code' | 'market'>) {
  if (stock.id.startsWith('em-')) return stock.id.slice(3)
  if (stock.market === 'CN') {
    const code = stock.code
    return code.startsWith('6') || code.startsWith('9') ? `1.${code}` : `0.${code}`
  }
  if (stock.market === 'HK') {
    return `116.${stock.code.replace(/\.HK$/i, '').padStart(5, '0')}`
  }
  return US_IDS[stock.code] ?? `105.${stock.code.replace('.', '')}`
}
