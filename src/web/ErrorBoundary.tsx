import { Component, type ReactNode } from "react";

/** If rendering fails, say so and offer a reload, rather than leaving a blank screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="crashed">
        <h1>Something went wrong</h1>
        <p className="muted">{this.state.error.message}</p>
        <button className="primary" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
