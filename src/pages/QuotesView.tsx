import { EmbedPage } from '../components/EmbedPage'
import { useGame } from '../store/gameStore'

export function QuotesView() {
  const { setScreen } = useGame()

  return (
    <EmbedPage
      title="训练家名言"
      subtitle="投资大师的智慧与警句"
      src="/investmentQuotes"
      onBack={() => setScreen({ name: 'menu' })}
    />
  )
}
