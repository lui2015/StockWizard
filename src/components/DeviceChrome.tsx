import { useEffect, useState, type ReactNode } from 'react'
import { useGame } from '../store/gameStore'
import type { Screen } from '../data/types'
import { sfx } from '../utils/sound'

const NAV: { id: Screen['name']; label: string }[] = [
  { id: 'party', label: '队伍' },
  { id: 'menu', label: '菜单' },
  { id: 'grass', label: '草地' },
  { id: 'trainer', label: '训练家' },
]

const IMMERSIVE_KEY = 'stock-wizard-immersive'

export function DeviceChrome({ children }: { children: ReactNode }) {
  const { screen, setScreen, play } = useGame()
  const hideNav = screen.name === 'title'
  const [immersive, setImmersive] = useState(() => localStorage.getItem(IMMERSIVE_KEY) === '1')

  useEffect(() => {
    localStorage.setItem(IMMERSIVE_KEY, immersive ? '1' : '0')
  }, [immersive])

  const toggleImmersive = () => {
    play(sfx.blip)
    setImmersive((v) => !v)
  }

  return (
    <div className={`device-wrap${immersive ? ' immersive' : ''}`}>
      <div className={`device${immersive ? ' immersive' : ''}`}>
        <i className="screw tl" aria-hidden />
        <i className="screw tr" aria-hidden />
        <header className="device-top">
          <span className="led" />
          {!immersive ? <span className="brand">STOCK WIZARD</span> : <span />}
          <button
            className="lens-btn"
            onClick={toggleImmersive}
            title={immersive ? '退出全屏' : '全屏展示（隐藏机身边框）'}
            aria-label="切换全屏展示"
          >
            <span className="lens" />
          </button>
        </header>
        <div className="screen-wrap">
          <div className={`screen ${screen.name === 'title' ? 'screen-title' : ''}`}>
            {children}
          </div>
        </div>
        <div className="device-speaker" aria-hidden>
          <span />
          <span />
          <span />
          <span />
          <span />
          <span />
          <i className="speaker-dot" />
        </div>
        {!hideNav ? (
          <nav className="device-nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={
                  screen.name === item.id ||
                  (item.id === 'dex' && screen.name === 'detail') ||
                  (item.id === 'menu' && (screen.name === 'settings' || screen.name === 'reports' || screen.name === 'report'))
                    ? 'on'
                    : ''
                }
                onClick={() => {
                  play(sfx.blip)
                  setScreen({ name: item.id } as Screen)
                }}
              >
                {item.label}
              </button>
            ))}
          </nav>
        ) : null}
        <i className="screw bl" aria-hidden />
        <i className="screw br" aria-hidden />
      </div>
    </div>
  )
}
