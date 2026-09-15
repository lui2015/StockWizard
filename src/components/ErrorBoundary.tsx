import { Component, type ErrorInfo, type ReactNode } from 'react'

export class ErrorBoundary extends Component<
  { children: ReactNode; onReset?: () => void },
  { failed: boolean }
> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="panel">
        <header className="panel-head">
          <h2>画面中断</h2>
          <p>刚才那页卡住了。回菜单再进一次就行。</p>
        </header>
        <div className="actions">
          <button
            className="btn"
            onClick={() => {
              this.setState({ failed: false })
              this.props.onReset?.()
            }}
          >
            回菜单
          </button>
        </div>
      </div>
    )
  }
}
