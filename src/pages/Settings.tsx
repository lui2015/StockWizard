import { useGame } from '../store/gameStore'
import { sfx } from '../utils/sound'

export function Settings() {
  const { save, toggleSound, reset, setScreen, play } = useGame()

  return (
    <div className="panel settings-panel">
      <header className="panel-head row">
        <h2>说明书</h2>
        <button className="tiny" onClick={() => setScreen({ name: 'menu' })}>
          返回
        </button>
      </header>

      <section className="manual">
        <h3>怎么玩</h3>
        <p>1. 走进草地，随机遭遇股票精灵。</p>
        <p>2. 先观察习性，再投球捕捉（加入自选）。</p>
        <p>3. 图鉴记录遇见与捕捉。可建多支队伍，每队最多带 6 只，随时切换查看。</p>
        <p>4. 分析页用稳健 / 爆发 / 安全垫 / 成长 / 分红 / 换手来读一只股票。</p>
        <p>5. 草地里的「搜索 / 精灵雷达」调用东方财富公开接口，可搜 A股和港股。</p>
        <h3>音效</h3>
        <button
          className="btn"
          onClick={() => {
            toggleSound()
            play(sfx.select)
          }}
        >
          {save.soundOn ? '音效：开' : '音效：关'}
        </button>
        <h3>存档</h3>
        <button
          className="btn ghost"
          onClick={() => {
            if (confirm('确定重置图鉴？捕捉、队伍和遇见记录都会消失。')) {
              reset()
            }
          }}
        >
          重置图鉴
        </button>
        <h3>声明</h3>
        <p className="fine">
          股票精灵是娱乐向图鉴。现价与分时来自东方财富公开接口，不构成任何投资建议，也不提供交易下单。请不要把「捕捉成功率」理解成买卖信号。
        </p>
      </section>
    </div>
  )
}
