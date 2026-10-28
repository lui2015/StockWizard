import { useEffect, useMemo, useState } from 'react'
import { classifyNews, fetchStockNews, type NewsItem } from '../api/news'
import type { StockSprite } from '../data/types'
import { sfx } from '../utils/sound'
import { useGame } from '../store/gameStore'

/**
 * 观察页「当日资讯」：调用东财开放接口拉取个股资讯，
 * 按标题关键词分为利多 / 利空，点击在新标签页查看详情。
 */
export function StockNewsPanel({ stock }: { stock: StockSprite }) {
  const { play } = useGame()
  const [rows, setRows] = useState<NewsItem[]>([])
  const [status, setStatus] = useState<'load' | 'ok' | 'empty'>('load')

  useEffect(() => {
    let alive = true
    setStatus('load')
    fetchStockNews(stock)
      .then((list) => {
        if (!alive) return
        setRows(list)
        setStatus(list.length ? 'ok' : 'empty')
      })
      .catch(() => {
        if (alive) setStatus('empty')
      })
    return () => {
      alive = false
    }
  }, [stock.id, stock.code, stock.market])

  const todayLocal = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`

  const groups = useMemo(() => {
    const pool = rows.filter((r) => r.time.startsWith(todayLocal))
    const useRows = pool.length ? pool : rows
    const bull = useRows.filter((r) => classifyNews(r.title) === 'bull').slice(0, 5)
    const bear = useRows.filter((r) => classifyNews(r.title) === 'bear').slice(0, 5)
    return { bull, bear, isToday: pool.length > 0 }
  }, [rows, todayLocal])

  const open = (item: NewsItem) => {
    play(sfx.select)
    window.open(item.url, '_blank', 'noopener')
  }

  const renderItem = (item: NewsItem) => (
    <li key={item.code}>
      <button className="news-item" onClick={() => open(item)}>
        <b>{item.title}</b>
        <small>
          {item.time} · 东财资讯 · 点击查看详情 ↗
        </small>
      </button>
    </li>
  )

  return (
    <section className="news-panel">
      {status === 'load' ? <p className="empty">正在获取当日资讯…</p> : null}
      {status === 'empty' ? <p className="empty">暂时读不到该股票的资讯。</p> : null}
      {status === 'ok' ? (
        <>
          {!groups.isToday ? <p className="fine">今日暂无新资讯，以下为最新动态：</p> : null}
          <h3>利多资讯</h3>
          <ul className="news-list">
            {groups.bull.length ? (
              groups.bull.map(renderItem)
            ) : (
              <li className="none">当日暂无明显利多资讯。</li>
            )}
          </ul>
          <h3>利空资讯</h3>
          <ul className="news-list">
            {groups.bear.length ? (
              groups.bear.map(renderItem)
            ) : (
              <li className="none">当日暂无明显利空资讯。</li>
            )}
          </ul>
        </>
      ) : null}
    </section>
  )
}
