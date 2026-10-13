import { useEffect, useRef } from 'react'
import { DeviceChrome } from './components/DeviceChrome'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useGame } from './store/gameStore'
import { DexDetail } from './pages/DexDetail'
import { Grassland } from './pages/Grassland'
import { MainMenu } from './pages/MainMenu'
import { Party } from './pages/Party'
import { Pokedex } from './pages/Pokedex'
import { Settings } from './pages/Settings'
import { TitleScreen } from './pages/TitleScreen'
import { Reports } from './pages/Reports'
import { ReportView } from './pages/ReportView'
import { TrainerCard } from './pages/TrainerCard'
import { AcademyView } from './pages/AcademyView'
import { QuotesView } from './pages/QuotesView'
import { DecisionView } from './pages/DecisionView'
import { AccountView } from './pages/AccountView'
import { sfx } from './utils/sound'

export function App() {
  const { screen, setScreen, save, quotes, fireAlert, play } = useGame()
  const firedRef = useRef(new Set<string>())

  // 每次行情刷新检查所有提醒：买入 ≤ 预期价、卖出 ≥ 预期价 即触发并标记，
  // 触发结果在队伍列表等位置持久展示（不弹窗、不消失）
  useEffect(() => {
    const alerts = save.alerts ?? {}
    for (const [stockId, list] of Object.entries(alerts)) {
      const quote = quotes[stockId]
      if (!quote?.live || !(quote.price > 0)) continue
      for (const alert of list) {
        if (alert.triggered || firedRef.current.has(alert.id)) continue
        const hit = alert.side === 'buy' ? quote.price <= alert.price : quote.price >= alert.price
        if (!hit) continue
        firedRef.current.add(alert.id)
        fireAlert(stockId, alert.id)
        play(sfx.select)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quotes, save.alerts])

  let view = null
  switch (screen.name) {
    case 'title':
      view = <TitleScreen />
      break
    case 'menu':
      view = <MainMenu />
      break
    case 'dex':
      view = <Pokedex />
      break
    case 'detail':
      view = <DexDetail id={screen.id} tab={screen.tab} />
      break
    case 'grass':
      view = <Grassland />
      break
    case 'party':
      view = <Party />
      break
    case 'trainer':
      view = <TrainerCard />
      break
    case 'academy':
      view = <AcademyView />
      break
    case 'quotes':
      view = <QuotesView />
      break
    case 'decision':
      view = <DecisionView />
      break
    case 'account':
      view = <AccountView />
      break
    case 'reports':
      view = <Reports />
      break
    case 'report':
      view = <ReportView id={screen.id} />
      break
    case 'settings':
      view = <Settings />
      break
  }

  return (
    <DeviceChrome>
      <ErrorBoundary onReset={() => setScreen({ name: 'menu' })}>{view}</ErrorBoundary>
    </DeviceChrome>
  )
}
