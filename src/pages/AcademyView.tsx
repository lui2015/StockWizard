import { EmbedPage } from '../components/EmbedPage'
import { useGame } from '../store/gameStore'

export function AcademyView() {
  const { setScreen } = useGame()

  return (
    <EmbedPage
      title="学堂"
      subtitle="小白金融 · 投资从入门到进阶"
      src="/XiaoBaiFinance"
      onBack={() => setScreen({ name: 'menu' })}
    />
  )
}
