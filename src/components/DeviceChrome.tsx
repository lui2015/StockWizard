import type { ReactNode } from 'react'
import { useGame } from '../store/gameStore'
import type { Screen } from '../data/types'
import { sfx } from '../utils/sound'

const NAV: { id: Screen['name']; label: string }[] = [
  { id: 'party', label: '队伍' },
  { id: 'menu', label: '菜单' },
  { id: 'grass', label: '草地' },
  { id: 'trainer', label: '训练家' },
]

export function DeviceChrome({ children }: { children: ReactNode }) {
  const { screen, setScreen, play } = useGame()
  const hideNav = screen.name === 'title'

  return (
    <div className="device-wrap">
      <div className="device">
        <header className="device-top">
          <span className="led" />
          <span className="brand">STOCK WIZARD</span>
          <span className="lens" />
        </header>
        <div className={`screen ${screen.name === 'title' ? 'screen-title' : ''}`}>
          {children}
        </div>
        {!hideNav ? (
          <nav className="device-nav">
            {NAV.map((item) => (
              <button
                key={item.id}
                className={
                  screen.name === item.id ||
                  (item.id === 'dex' && screen.name === 'detail') ||
                  (item.id === 'menu' && screen.name === 'settings')
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
      </div>
    </div>
  )
}
