import { Component, type ReactNode } from 'react'

type State = { failed: boolean }

/** If anything goes wrong while drawing the page, say so plainly and offer the plain versions. */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[site] something went wrong', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <div className="simple">
        <main className="simple__main">
          <section className="plain-section">
            <h1>Something went wrong on the trail</h1>
            <p>Sorry: this page couldn’t be shown. Reloading usually helps.</p>
            <p>
              <a className="btn" href={location.pathname}>
                Reload
              </a>{' '}
              <a className="btn btn--ghost" href="/llms.txt">
                The blog, in plain text
              </a>
            </p>
          </section>
        </main>
      </div>
    )
  }
}
