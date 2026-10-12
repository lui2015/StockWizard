import { EmbedPage } from '../components/EmbedPage'
import { useGame } from '../store/gameStore'

export function DecisionView() {
  const { setScreen } = useGame()
  return (
    <EmbedPage
      title="训练家决策"
      subtitle="训练家的投资决策助手"
      src="/investmentDecision/"
      defaultFullscreen
      onBack={() => setScreen({ name: 'menu' })}
    />
  )
}
