import { useGame } from '../store/gameStore'

export function QuotesView() {
  const { setScreen } = useGame()

  return (
    <div className="panel academy-view">
      <header className="panel-head row">
        <div>
          <h2>训练家名言</h2>
          <p>投资大师的智慧与警句</p>
        </div>
        <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
          返回
        </button>
      </header>
      <iframe
        className="academy-frame"
        title="训练家名言"
        src="/investmentQuotes"
      />
    </div>
  )
}
