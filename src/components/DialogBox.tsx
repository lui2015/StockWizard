import { useEffect, useState } from 'react'

export function DialogBox({
  speaker,
  text,
  onDone,
}: {
  speaker?: string
  text: string
  onDone?: () => void
}) {
  const [n, setN] = useState(0)

  useEffect(() => {
    setN(0)
    const t = window.setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          window.clearInterval(t)
          return v
        }
        return v + 1
      })
    }, 12)
    return () => window.clearInterval(t)
  }, [text])

  const done = n >= text.length

  return (
    <button
      type="button"
      className="dialog"
      onClick={() => {
        if (!done) setN(text.length)
        else onDone?.()
      }}
    >
      {speaker ? <b className="dialog-name">{speaker}</b> : null}
      <p>
        {text.slice(0, n)}
        <span className={done ? 'caret blink' : 'caret'}>▼</span>
      </p>
    </button>
  )
}
