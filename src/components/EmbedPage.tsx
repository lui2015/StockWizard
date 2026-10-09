import { useEffect, useState } from 'react'

/**
 * 内嵌网页的通用详情页（学堂 / 训练家名言 / 分析报告）
 * 支持全屏查看：全屏时锁住页面滚动。
 */
export function EmbedPage({
  title,
  subtitle,
  src,
  sandbox,
  defaultFullscreen = false,
  onBack,
}: {
  title: string
  subtitle: string
  src: string
  sandbox?: string
  defaultFullscreen?: boolean
  onBack?: () => void
}) {
  const [fullscreen, setFullscreen] = useState(defaultFullscreen)

  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  return (
    <div className={fullscreen ? 'panel report-view fullscreen' : 'panel report-view'}>
      <header className="panel-head row">
        <div>
          <h2>{title}</h2>
          <p>{subtitle}</p>
        </div>
        <div className="head-ops">
          {onBack ? (
            <button className="tiny" onClick={onBack}>
              返回列表
            </button>
          ) : null}
          <button className="tiny" onClick={() => setFullscreen((v) => !v)}>
            {fullscreen ? '退出全屏' : '全屏'}
          </button>
        </div>
      </header>
      <iframe className="report-frame" title={title} src={src} sandbox={sandbox} />
    </div>
  )
}
