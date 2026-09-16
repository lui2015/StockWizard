import { useEffect, useState } from 'react'
import { getReport } from '../api/reports'
import { api } from '../api/base'
import { useGame } from '../store/gameStore'

export function ReportView({ id }: { id: string }) {
  const { setScreen } = useGame()
  const [title, setTitle] = useState('分析报告')
  const [error, setError] = useState('')
  const [fullscreen, setFullscreen] = useState(false)

  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  useEffect(() => {
    let alive = true
    void getReport(id)
      .then((doc) => {
        if (alive) setTitle(doc.title)
      })
      .catch((err) => {
        if (alive) setError(err instanceof Error ? err.message : '报告打不开')
      })
    return () => {
      alive = false
    }
  }, [id])

  return (
    <div className={fullscreen ? 'panel report-view fullscreen' : 'panel report-view'}>
      <header className="panel-head row">
        <div>
          <h2>{title}</h2>
          <p>仅供阅读 · 不构成投资建议</p>
        </div>
        <div className="head-ops">
          <button className="tiny" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? '退出全屏' : '全屏'}
          </button>
          <button
            className="tiny"
            onClick={() => {
              setFullscreen(false)
              setScreen({ name: 'reports' })
            }}
          >
            返回
          </button>
        </div>
      </header>
      {error ? (
        <p className="empty">{error}</p>
      ) : (
        <iframe
          className="report-frame"
          title={title}
          src={api(`/api/reports/${encodeURIComponent(id)}/raw`)}
          sandbox="allow-same-origin"
        />
      )}
    </div>
  )
}
