import { api } from './base'
import { quoteIdOf } from '../utils/quoteId'
import type { StockSprite } from '../data/types'

export interface NewsItem {
  code: string
  title: string
  time: string
  url: string
}

/** 拉取个股资讯（东财 np-listapi 开放接口，经服务端代理） */
export async function fetchStockNews(stock: Pick<StockSprite, 'id' | 'code' | 'market'>): Promise<NewsItem[]> {
  const url = api(`/radar/news?secid=${encodeURIComponent(quoteIdOf(stock))}`)
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error('资讯接口中断')
  const json = (await res.json()) as { data?: { list?: NewsItem[] } }
  return json.data?.list ?? []
}

const BULL_WORDS =
  /利好|中标|签署|签约|回购|增持|分红|派息|预增|获批|批准|合作|突破|上涨|涨停|增长|创新高|订单|涨价|净流入|企稳|回暖|改善|向好|荣获|入选|扩张|提升|超额/

const BEAR_WORDS =
  /利空|减持|质押|处罚|诉讼|仲裁|预亏|下跌|跌停|下滑|调查|警示|解禁|做空|罚款|亏损|回落|退市|暂停|下架|问询|冻结|违规|立案|终止|取消|失败|下调|缩水|流出/

export type NewsSentiment = 'bull' | 'bear' | 'neutral'

/** 按标题关键词把资讯分为利多 / 利空 / 中性 */
export function classifyNews(title: string): NewsSentiment {
  if (BEAR_WORDS.test(title)) return 'bear'
  if (BULL_WORDS.test(title)) return 'bull'
  return 'neutral'
}
