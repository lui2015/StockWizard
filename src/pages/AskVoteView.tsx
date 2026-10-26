import { EmbedPage } from '../components/EmbedPage'
import { useGame } from '../store/gameStore'

export function AskVoteView() {
  const { setScreen } = useGame()
  return (
    <EmbedPage
      title="求一票"
      subtitle="为看好的股票拉票助威"
      src="/stockRecommend/"
      defaultFullscreen
      onBack={() => setScreen({ name: 'menu' })}
    />
  )
}
