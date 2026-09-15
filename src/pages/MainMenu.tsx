import { useEffect, useState } from 'react'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'
import type { Screen } from '../data/types'

const ITEMS: { name: Screen['name']; title: string; desc: string }[] = [
  { name: 'party', title: '我的队伍', desc: '可建多支队伍，每队最多 6 只' },
  { name: 'dex', title: '精灵图鉴', desc: '查看 24 只股票精灵的编号与记录' },
  { name: 'grass', title: '野外草地', desc: '走入草丛，遭遇并尝试捕捉' },
  { name: 'trainer', title: '训练家证', desc: '收集进度、称号与存档' },
  { name: 'reports', title: '分析报告', desc: '上传 HTML 研报，或用接口交给 AI 写入' },
  { name: 'settings', title: '说明书', desc: '玩法、音效与免责声明' },
]

export function MainMenu() {
  const { setScreen, play, save } = useGame()
  const [i, setI] = useState(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        setI((v) => (v + 1) % ITEMS.length)
        play(sfx.blip)
      }
      if (e.key === 'ArrowUp') {
        setI((v) => (v - 1 + ITEMS.length) % ITEMS.length)
        play(sfx.blip)
      }
      if (e.key === 'Enter') open(ITEMS[i].name)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  const open = (name: Screen['name']) => {
    play(sfx.select)
    setScreen({ name } as Screen)
  }

  return (
    <div className="panel menu-panel">
      <header className="panel-head">
        <h2>主菜单</h2>
        <p>
          你好，{save.trainerName}！今天想做什么？
        </p>
      </header>
      <ul className="menu-list">
        {ITEMS.map((item, idx) => (
          <li key={item.name}>
            <button
              className={idx === i ? 'menu-item on' : 'menu-item'}
              onMouseEnter={() => setI(idx)}
              onClick={() => open(item.name)}
            >
              <i className="cursor">{idx === i ? '▶' : ''}</i>
              <span>
                <b>{item.title}</b>
                <small>{item.desc}</small>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className="fine">方向键选择 · Enter 确认 · 实时行情约 12 秒刷新</p>
    </div>
  )
}
