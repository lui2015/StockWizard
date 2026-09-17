import { useEffect, useRef, useState } from 'react'
import { createReport, deleteReport, listReports, type ReportMeta } from '../api/reports'
import { REPORT_API, REPORT_API_HELP, REPORT_PROMPT } from '../data/reportPrompt'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

export function Reports() {
  const { setScreen, play } = useGame()
  const [rows, setRows] = useState<ReportMeta[]>([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [help, setHelp] = useState(false)
  const [copied, setCopied] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const refresh = async () => {
    try {
      setRows(await listReports())
      setError('')
    } catch (err) {
      setError(err instanceof Error ? err.message : '读不到报告列表')
    }
  }

  useEffect(() => {
    void refresh()
    const onFocus = () => void refresh()
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  const uploadFile = async (file: File) => {
    if (!/\.html?$/i.test(file.name)) {
      setError('只收 .html / .htm 文件。')
      return
    }
    setBusy(true)
    try {
      const html = await file.text()
      if (!/<html/i.test(html)) throw new Error('这不像一份完整 HTML。')
      const title = file.name.replace(/\.html?$/i, '')
      await createReport({ title, html, source: 'upload' })
      play(sfx.select)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(label)
      play(sfx.blip)
      window.setTimeout(() => setCopied(''), 1600)
    } catch {
      setError('复制失败，请手动选中文本。')
    }
  }

  return (
    <div className="panel reports-panel">
      <header className="panel-head row">
        <div>
          <h2>分析报告</h2>
          <p>{rows.length} 份 · HTML · 本机保存</p>
        </div>
      </header>

      <div className="actions">
        <button className="btn" disabled={busy} onClick={() => fileRef.current?.click()}>
          {busy ? '上传中…' : '上传 HTML'}
        </button>
        <button
          className="btn ghost"
          onClick={() => {
            play(sfx.blip)
            setHelp((v) => !v)
          }}
        >
          {help ? '收起接口' : '开放接口'}
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".html,.htm,text/html"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void uploadFile(file)
        }}
      />

      {help ? (
        <section className="report-help">
          <h3>给 AI 的上传提示词</h3>
          <p>复制后发给 Cursor / 其他助手，让它写完 HTML 并 POST 到本机。</p>
          <div className="actions">
            <button className="btn" onClick={() => void copy(REPORT_PROMPT, '提示词')}>
              {copied === '提示词' ? '已复制' : '复制提示词'}
            </button>
            <button className="btn ghost" onClick={() => void copy(REPORT_API_HELP, '接口')}>
              {copied === '接口' ? '已复制' : '复制接口说明'}
            </button>
          </div>
          <pre className="report-code">{REPORT_PROMPT}</pre>
          <h3>接口</h3>
          <p className="fine">{REPORT_API}</p>
          <pre className="report-code">{REPORT_API_HELP}</pre>
        </section>
      ) : null}

      {error ? <p className="empty">{error}</p> : null}

      <ol className="dex-list">
        {rows.map((row) => (
          <li key={row.id}>
            <div className="report-row">
              <button
                className="dex-row report-main"
                onClick={() => {
                  play(sfx.select)
                  setScreen({ name: 'report', id: row.id })
                }}
              >
                <em>{row.source === 'api' ? '接口' : '上传'}</em>
                <span className="dex-name">
                  <b>{row.title}</b>
                  <small>
                    {new Date(row.createdAt).toLocaleString('zh-CN', { hour12: false })}
                    {row.bytes ? ` · ${Math.max(1, Math.round(row.bytes / 1024))}KB` : ''}
                  </small>
                </span>
              </button>
              <button
                className="tiny"
                onClick={() => {
                  if (!confirm(`删除「${row.title}」？`)) return
                  void deleteReport(row.id)
                    .then(() => {
                      play(sfx.run)
                      return refresh()
                    })
                    .catch((err) => setError(err instanceof Error ? err.message : '删除失败'))
                }}
              >
                删
              </button>
            </div>
          </li>
        ))}
      </ol>
      {!rows.length && !error ? <p className="empty">还没有报告。上传一份 HTML，或让 AI 走开放接口写入。</p> : null}
    </div>
  )
}
