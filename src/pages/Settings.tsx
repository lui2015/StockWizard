import { useState } from 'react'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

export function Settings() {
  const { save, toggleSound, reset, setScreen, play, user, logout } = useGame()
  const [busy, setBusy] = useState(false)

  const signOut = async () => {
    setBusy(true)
    await logout()
    play(sfx.blip)
    setBusy(false)
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
