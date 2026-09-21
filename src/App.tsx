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

export function App() {
  const { screen, setScreen } = useGame()

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
