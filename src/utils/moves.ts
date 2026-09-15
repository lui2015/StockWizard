import type { Quote, Sector, StockSprite } from '../data/types'
import { changePct } from './quotes'

const MOVE_BOOK: Record<Sector, [string, string, string]> = {
  tech: ['回调消化', '温和反弹', '估值扩张'],
  consumer: ['缩量整理', '渠道回暖', '旺季放量'],
  finance: ['息差收窄', '温和修复', '风险回升'],
  healthcare: ['管线冷静', '数据催化', '授权高潮'],
  energy: ['油价回落', '震荡蓄力', '油价冲高'],
  industrials: ['订单回落', '开工回暖', '产能爆发'],
  property: ['信用收缩', '政策托底', '销售回暖'],
  internet: ['流量退潮', '广告回暖', '平台狂欢'],
  cyclical: ['去库存', '预期修复', '题材高潮'],
  conglomerate: ['折价加深', '稳健分红', '资产重估'],
}

export function moveLog(stock: StockSprite, quote: Quote) {
  const type = stock.types[0]
  const [low, mid, high] = MOVE_BOOK[type]
  const logs: { name: string; text: string; power: number }[] = []
  const pts = quote.series
  for (let i = 1; i < pts.length; i++) {
    const delta = ((pts[i] - pts[i - 1]) / pts[i - 1]) * 100
    if (Math.abs(delta) < 0.35) continue
    const name = delta > 1.6 ? high : delta > 0 ? mid : low
    logs.push({
      name,
      text: `${delta > 0 ? '+' : ''}${delta.toFixed(2)}%`,
      power: delta,
    })
  }
  return logs.slice(-6)
}

export function habitText(stock: StockSprite, quote: Quote) {
  const pct = changePct(quote)
  if (pct > 3) return `买盘很热。${stock.name}今天情绪偏高，适合记下这笔波动，不宜追着加仓观察位。`
  if (pct > 0.6) return `${stock.name}正沿着均线慢慢走，偶有小单推进，整体还算平静。`
  if (pct > -0.6) return `${stock.name}在横盘休息。成交不急，没有要变盘的意思。`
  if (pct > -3) return `资金在撤退。${stock.name}把波动收起来，警惕地看着盘口。`
  return `${stock.name}今天明显避险。观察需保持距离，先看它回不回得来。`
}
