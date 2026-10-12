import { useEffect, useState } from 'react'
import { listReports, type ReportMeta } from '../api/reports'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

/**
 * 分析页「关联分析报告」：把分析报告模块里的任意报告关联到当前股票精灵。
 * 关联关系保存在本机/云存档 reportLinks[股票id] 中。
 */
export function ReportLinks({ stockId }: { stockId: string }) {
  const { save, linkReport, unlinkReport, setScreen, play } = useGame()
  const [rows, setRows] = useState<ReportMeta[]>([])
  const [picking, setPicking] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    listReports()
      .then((list) => {
        if (alive) setRows(list)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : '读不到报告列表')
      })
    return () => {
      alive = false
    }
  }, [])

  const metaById = new Map(rows.map((row) => [row.id, row]))
  const linked = (save.reportLinks?.[stockId] ?? []).filter((id) => metaById.has(id))
  const pickable = rows.filter((row) => !linked.includes(row.id))

  const openReport = (id: string) => {
    play(sfx.select)
    setScreen({ name: 'report', id })
  }

  return (
    <section className="report-links">
      <h3>关联分析报告</h3>
      {error ? <p className="empty">{error}</p> : null}
      {linked.length ? (
        <ul className="link-list">
          {linked.map((id) => {
            const meta = metaById.get(id)
            return (
              <li key={id}>
                <button
                  className="link-item"
                  onClick={() => openReport(id)}
                >
                  <b>{meta?.title ?? '未命名报告'}</b>
                  <small>
                    {meta
                      ? `${meta.source === 'api' ? '接口' : '上传'} · ${new Date(meta.createdAt).toLocaleDateString('zh-CN')}`
                      : ''}
                  </small>
                </button>
                <button
                  className="tiny"
                  onClick={() => {
                    play(sfx.run)
                    unlinkReport(stockId, id)
                  }}
                >
                  解除
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="empty">{rows.length ? '还没有关联的报告，点下方按钮挑选。' : '分析报告模块里还没有报告，先去上传或用接口写入。'}</p>
      )}

      {picking ? (
        <div className="link-picker">
          {pickable.length ? (
            pickable.map((row) => (
              <button
                key={row.id}
                className="link-item"
                onClick={() => {
                  play(sfx.select)
                  linkReport(stockId, row.id)
                  setPicking(false)
                }}
              >
                <b>{row.title}</b>
                <small>
                  {row.source === 'api' ? '接口' : '上传'} ·{' '}
                  {new Date(row.createdAt).toLocaleDateString('zh-CN')}
                  {row.bytes ? ` · ${Math.max(1, Math.round(row.bytes / 1024))}KB` : ''}
                </small>
              </button>
            ))
          ) : (
            <p className="empty">所有报告都已关联。</p>
          )}
        </div>
      ) : null}

      {rows.length ? (
        <div className="actions">
          <button className="btn ghost" onClick={() => setPicking((v) => !v)}>
            {picking ? '收起列表' : '关联报告'}
          </button>
        </div>
      ) : null}
    </section>
  )
}
