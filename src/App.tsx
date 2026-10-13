import { useEffect, useRef, useState } from 'react'
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
import { getStock } from './data/stocks'
import { formatPrice } from './utils/quotes'
import { sfx } from './utils/sound'

/** 价格提醒触发弹窗（全局，任意页面都会提示） */
function AlertToast({ msg, onClose }: { msg: string; onClose: () => void }) {
  return (
    <button type="button" className="alert-toast" onClick={onClose}>
      <b>🔔 提醒触发</b>
      <span>{msg}</span>
      <small>点击关闭</small>
    </button>
  )
}

export function App() {
  const { screen, setScreen, save, quotes, fireAlert, play } = useGame()
  const [toast, setToast] = useState('')
  const firedRef = useRef(new Set<string>())

  // 每次行情刷新检查所有提醒：买入 ≤ 预期价、卖出 ≥ 预期价 即触发
  useEffect(() => {
    const alerts = save.alerts ?? {}
    for (const [stockId, list] of Object.entries(alerts)) {
      const quote = quotes[stockId]
      if (!quote?.live || !(quote.price > 0)) continue
      const stock = getStock(stockId)
      for (const alert of list) {
        if (alert.triggered || firedRef.current.has(alert.id)) continue
        const hit = alert.side === 'buy' ? quote.price <= alert.price : quote.price >= alert.price
        if (!hit) continue
        firedRef.current.add(alert.id)
        fireAlert(stockId, alert.id)
        play(sfx.select)
        setToast(
          `${alert.side === 'buy' ? '买入' : '卖出'}提醒：${stock.name} 现价 ${formatPrice(
            quote.price,
          )} 已${alert.side === 'buy' ? '跌破' : '升破'}预期 ${formatPrice(alert.price)}`,
        )
        window.setTimeout(() => setToast(''), 8000)
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
      {toast ? <AlertToast msg={toast} onClose={() => setToast('')} /> : null}
    </DeviceChrome>
  )
}
