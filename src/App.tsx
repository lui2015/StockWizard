import { useEffect, useRef } from 'react'
import { DeviceChrome } from './components/DeviceChrome'
import { ErrorBoundary } from './components/ErrorBoundary'
import { useGame } from './store/gameStore'
import { DexDetail } from './pages/DexDetail'
import { Grassland } from './pages/Grassland'
import { GuessView } from './pages/GuessView'
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
import { AskVoteView } from './pages/AskVoteView'
import { AccountView } from './pages/AccountView'
import { fetchMarketTape, type TapeIndex } from './api/eastmoney'
import { changePct } from './utils/quotes'
import { todayStr } from './utils/stats'
import { sfx } from './utils/sound'

export function App() {
  const { screen, setScreen, save, quotes, fireAlert, resolveGuesses, play } = useGame()
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

  // 猜涨跌结算：非下注当天打开应用时，用当天实际涨跌结算未完成的预测
  useEffect(() => {
    const tick = () => {
      const today = todayStr()
      const pending = (save.guesses ?? []).filter((g) => !g.resolved && g.date !== today)
      if (!pending.length) return
      const run = async () => {
        let tape: TapeIndex[] = []
        if (pending.some((g) => g.target.startsWith('index:'))) {
          tape = await fetchMarketTape().catch(() => [])
        }
        const results = pending
          .map((g) => {
            const pct = g.target.startsWith('index:')
              ? tape.find((row) => row.id === g.target.slice(6))?.pct
              : quotes[g.target]
                ? changePct(quotes[g.target])
                : undefined
            return pct == null ? null : { id: g.id, change: pct }
          })
          .filter((r): r is { id: string; change: number } => r != null)
        if (results.length) resolveGuesses(results)
      }
      void run()
    }
    tick()
    const timer = window.setInterval(tick, 30000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save.guesses, quotes])

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
    case 'askvote':
      view = <AskVoteView />
      break
    case 'guess':
      view = <GuessView />
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
