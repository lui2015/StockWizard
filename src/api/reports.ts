export interface ReportMeta {
  id: string
  title: string
  createdAt: number
  source: 'upload' | 'api'
  bytes: number
}

export interface ReportDoc extends ReportMeta {
  html: string
}

async function readJson<T>(res: Response): Promise<T> {
  const text = await res.text()
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error('报告接口无响应')
  }
}

export async function listReports(): Promise<ReportMeta[]> {
  const res = await fetch('/api/reports', { headers: { Accept: 'application/json' } })
  const json = await readJson<{ ok?: boolean; reports?: ReportMeta[]; error?: string }>(res)
  if (!res.ok || !json.ok) throw new Error(json.error || '读不到报告列表')
  return json.reports ?? []
}

export async function getReport(id: string): Promise<ReportDoc> {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, { headers: { Accept: 'application/json' } })
  const json = await readJson<ReportDoc & { ok?: boolean; error?: string }>(res)
  if (!res.ok || json.ok === false) throw new Error(json.error || '报告不存在')
  return json
}

export async function createReport(input: { title?: string; html: string; source?: 'upload' | 'api' }) {
  const res = await fetch('/api/reports', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(input),
  })
  const json = await readJson<{ ok?: boolean; id?: string; title?: string; error?: string }>(res)
  if (!res.ok || !json.ok || !json.id) throw new Error(json.error || '上传失败')
  return { id: json.id, title: json.title ?? input.title ?? '未命名报告' }
}

export async function deleteReport(id: string) {
  const res = await fetch(`/api/reports/${encodeURIComponent(id)}`, { method: 'DELETE' })
  const json = await readJson<{ ok?: boolean; error?: string }>(res)
  if (!res.ok || !json.ok) throw new Error(json.error || '删除失败')
}
