import { useEffect, useState } from 'react'
import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'
import type { Screen } from '../data/types'

const ITEMS: { name: Screen['name']; title: string; desc: string }[] = [
  { name: 'dex', title: '精灵图鉴', desc: '查看 24 只股票精灵的编号与记录' },
  { name: 'academy', title: '学堂', desc: '小白金融学堂 · 从入门到进阶' },
  { name: 'quotes', title: '训练家名言', desc: '投资大师的智慧与警句' },
  { name: 'decision', title: '训练家决策', desc: '投资决策助手 · 助你科学下单' },
  { name: 'reports', title: '分析报告', desc: '上传 HTML 研报，或用接口交给 AI 写入' },
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
    </div>
  )
}
