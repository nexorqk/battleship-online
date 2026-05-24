import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <main className="game-page">
          <div className="loading-state">
            <p className="loading-text loading-error">
              Something went wrong
            </p>
            <p style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginTop: 8 }}>
              {this.state.error?.message}
            </p>
            <button
              className="btn-action primary-action"
              style={{ marginTop: 16 }}
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.href = "/";
              }}
            >
              Back to Home
            </button>
          </div>
        </main>
      );
    }

    return this.props.children;
  }
}
