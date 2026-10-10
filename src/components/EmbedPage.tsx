import { useEffect, useRef, useState } from 'react'

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
  const [headHide, setHeadHide] = useState(false)
  const frameRef = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    if (!fullscreen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [fullscreen])

  // 全屏沉浸模式：iframe 内容下滑时隐藏头部，上滑恢复
  useEffect(() => {
    if (!fullscreen) {
      setHeadHide(false)
      return
    }
    const frame = frameRef.current
    if (!frame) return

    let lastY = 0
    let docRef: Document | null = null
    const onScroll = () => {
      if (!docRef) return
      const y = docRef.documentElement?.scrollTop ?? docRef.body?.scrollTop ?? 0
      if (y > lastY && y > 60) setHeadHide(true)
      else if (y < lastY - 2 || y <= 60) setHeadHide(false)
      lastY = y
    }
    const attach = () => {
      const doc = frame.contentDocument
      if (!doc) return
      docRef = doc
      lastY = doc.documentElement?.scrollTop ?? 0
      doc.addEventListener('scroll', onScroll, { passive: true })
    }

    if (frame.contentDocument?.readyState === 'complete') attach()
    frame.addEventListener('load', attach)
    return () => {
      frame.removeEventListener('load', attach)
      docRef?.removeEventListener('scroll', onScroll)
    }
  }, [fullscreen])

  return (
    <div
      className={`panel report-view ${fullscreen ? 'fullscreen' : ''} ${fullscreen && headHide ? 'head-hide' : ''}`}
    >
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
      <iframe ref={frameRef} className="report-frame" title={title} src={src} sandbox={sandbox} />
    </div>
  )
}
