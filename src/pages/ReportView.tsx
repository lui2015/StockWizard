import { useEffect, useState } from 'react'
import { getReport } from '../api/reports'
import { api } from '../api/base'
import { EmbedPage } from '../components/EmbedPage'

export function ReportView({ id }: { id: string }) {
  const [title, setTitle] = useState('分析报告')
  const [error, setError] = useState('')

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

  if (error) {
    return (
      <div className="panel report-view">
        <header className="panel-head row">
          <div>
            <h2>{title}</h2>
            <p>仅供阅读 · 不构成投资建议</p>
          </div>
        </header>
        <p className="empty">{error}</p>
      </div>
    )
  }

  return (
    <EmbedPage
      title={title}
      subtitle="仅供阅读 · 不构成投资建议"
      src={api(`/api/reports/${encodeURIComponent(id)}/raw`)}
      sandbox="allow-same-origin"
    />
  )
}
