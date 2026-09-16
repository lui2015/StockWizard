import { useGame } from '../store/gameStore'

export function AcademyView() {
  const { setScreen } = useGame()

  return (
    <div className="panel academy-view">
      <header className="panel-head row">
        <div>
          <h2>学堂</h2>
          <p>小白金融 · 投资从入门到进阶</p>
        </div>
        <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
          返回
        </button>
      </header>
      <iframe
        className="academy-frame"
        title="小白金融学堂"
        src="/XiaoBaiFinance"
      />
    </div>
  )
}
