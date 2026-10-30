import { useRef, useState } from 'react'
import { useGame } from '../store/gameStore'
import type { SaveData } from '../data/types'
import { sfx } from '../utils/sound'

/** 股票相关数据字段（导出/导入范围） */
const DATA_FIELDS: (keyof SaveData)[] = [
  'seen',
  'captured',
  'squads',
  'activeSquadId',
  'catchAttempts',
  'holdings',
  'alerts',
  'reportLinks',
  'discovered',
]

export function Settings() {
  const { save, toggleSound, reset, setScreen, play, user, logout, importData } = useGame()
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const signOut = async () => {
    setBusy(true)
    await logout()
    play(sfx.blip)
    setBusy(false)
  }

  const exportData = () => {
    const data = Object.fromEntries(DATA_FIELDS.map((key) => [key, save[key]]))
    const payload = {
      app: 'StockWizard',
      version: 1,
      exportedAt: new Date().toISOString(),
      data,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stockwizard-data-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    play(sfx.select)
  }

  const onImportFile = (file: File) => {
    void file
      .text()
      .then((text) => {
        const json = JSON.parse(text) as { app?: string; data?: Partial<SaveData> }
        const data = json?.data ?? json
        if (!data || typeof data !== 'object') throw new Error('文件格式不正确')
        const patch: Partial<SaveData> = {}
        for (const key of DATA_FIELDS) {
          const value = (data as Record<string, unknown>)[key]
          if (value !== undefined) (patch as Record<string, unknown>)[key] = value
        }
        if (Object.keys(patch).length === 0) throw new Error('文件里没有可导入的股票数据')
        if (!confirm('导入将覆盖当前的持仓、提醒、队伍与图鉴数据，确定继续？')) return
        importData(patch)
        play(sfx.select)
      })
      .catch((err) => {
        alert(`导入失败：${err instanceof Error ? err.message : '文件解析出错'}`)
      })
  }

  return (
    <div className="panel settings-panel">
      <header className="panel-head row">
        <h2>说明书</h2>
      </header>

      <section className="manual">
        <h3>怎么玩</h3>
        <p>1. 走进草地，随机遭遇股票精灵。</p>
        <p>2. 先观察习性，再投球捕捉（加入自选）。</p>
        <p>3. 图鉴记录遇见与捕捉。可建多支队伍，每队最多带 6 只，随时切换查看。</p>
        <p>4. 分析页用稳健 / 爆发 / 安全垫 / 成长 / 分红 / 换手来读一只股票。</p>
        <p>5. 草地里的「精灵雷达」可搜名称代码，也可按市场、板块和行业筛选 A股 / 港股。点「大盘行情」看上证、恒生和美股指数涨跌。</p>
        <p>6. 「分析报告」可手动上传 HTML，也可向本地接口 POST 研报。页面里有给 AI 用的上传提示词。</p>
        <h3>音效</h3>
        <button
          className="btn"
          onClick={() => {
            toggleSound()
            play(sfx.select)
          }}
        >
          {save.soundOn ? '音效：开' : '音效：关'}
        </button>
        <h3>存档</h3>
        <button
          className="btn ghost"
          onClick={() => {
            if (confirm('确定重置图鉴？捕捉、队伍和遇见记录都会消失。')) {
              reset()
            }
          }}
        >
          重置图鉴
        </button>
        <h3>数据</h3>
        <p className="fine">导出 / 导入我的股票相关数据：自选图鉴、持仓成本、买卖提醒、队伍与关联报告（JSON 文件）。</p>
        <div className="actions">
          <button className="btn" onClick={exportData}>
            导出数据
          </button>
          <button className="btn ghost" onClick={() => fileRef.current?.click()}>
            导入数据
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImportFile(file)
              e.target.value = ''
            }}
          />
        </div>
        <h3>账号</h3>
        {user ? (
          <div className="account-strip">
            <p className="book-meta">已登录：{user.username} · 队伍与持仓自动云同步</p>
            <button className="btn ghost" disabled={busy} onClick={() => void signOut()}>
              退出登录
            </button>
          </div>
        ) : (
          <div className="account-strip">
            <p className="book-meta">未登录，进度只保存在本机浏览器。</p>
            <button className="btn" onClick={() => setScreen({ name: 'account' })}>
              登录 / 注册
            </button>
          </div>
        )}
        <h3>声明</h3>
        <p className="fine">
          股票精灵是娱乐向图鉴。现价与分时来自东方财富公开接口，不构成任何投资建议，也不提供交易下单。请不要把「捕捉成功率」理解成买卖信号。
        </p>
      </section>
    </div>
  )
}
