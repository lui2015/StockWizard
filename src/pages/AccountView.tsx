import { useState } from 'react'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

export function AccountView() {
  const { user, cloudState, login, register, logout, setScreen, play } = useGame()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const submit = async () => {
    if (busy) return
    setMsg('')
    if (username.trim().length < 3 || password.length < 6) {
      setMsg('用户名至少 3 位，密码至少 6 位。')
      return
    }
    setBusy(true)
    try {
      const next = mode === 'login' ? await login(username.trim(), password) : await register(username.trim(), password)
      play(sfx.select)
      setMsg(`${mode === 'login' ? '已登录' : '注册成功'}：${next.username}，队伍、持仓和配置会自动同步到云端。`)
      setPassword('')
    } catch (err) {
      setMsg(err instanceof Error ? err.message : '操作失败，请重试')
    } finally {
      setBusy(false)
    }
  }

  const signOut = async () => {
    setBusy(true)
    await logout()
    play(sfx.blip)
    setMsg('已退出登录，当前进度仍保留在本机。')
    setBusy(false)
  }

  return (
    <div className="panel account-panel">
      <header className="panel-head row">
        <div>
          <h2>账号</h2>
          <p>{user ? '已开启云同步' : '登录后可跨设备同步队伍与持仓'}</p>
        </div>
        <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
          返回
        </button>
      </header>

      {user ? (
        <section className="book-card">
          <h3>当前账号</h3>
          <p className="book-meta">
            {user.username} · 云同步：
            {cloudState === 'saving' ? '同步中…' : cloudState === 'saved' ? '已保存' : cloudState === 'error' ? '同步失败（稍后重试）' : '待同步'}
          </p>
          <div className="actions">
            <button className="btn ghost" disabled={busy} onClick={() => void signOut()}>
              退出登录
            </button>
          </div>
        </section>
      ) : (
        <section className="book-card">
          <div className="tabs chart-tabs">
            <button className={mode === 'login' ? 'on' : ''} onClick={() => setMode('login')}>
              登录
            </button>
            <button className={mode === 'register' ? 'on' : ''} onClick={() => setMode('register')}>
              注册
            </button>
          </div>
          <label className="field-row">
            <span>用户名</span>
            <input
              value={username}
              maxLength={24}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="3-24 位字母、数字或 _ . -"
            />
          </label>
          <label className="field-row">
            <span>密码</span>
            <input
              type="password"
              value={password}
              maxLength={64}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void submit()
              }}
              placeholder="6-64 位"
            />
          </label>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => void submit()}>
              {busy ? '处理中…' : mode === 'login' ? '登录' : '注册并登录'}
            </button>
          </div>
          <p className="book-meta">
            账号会把队伍、持仓、图鉴进度和设置保存到服务器；未登录时仍只存在本机浏览器。
          </p>
        </section>
      )}

      {msg ? <p className="empty">{msg}</p> : null}
    </div>
  )
}
