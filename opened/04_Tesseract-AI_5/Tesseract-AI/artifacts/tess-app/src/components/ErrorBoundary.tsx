import { Component, type ReactNode, type ErrorInfo } from "react";
import { AlertCircle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.label ? ` (${this.props.label})` : ""}]`, error, info);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex flex-col items-center justify-center gap-4 p-8 text-center">
          <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-6 max-w-md w-full">
            <AlertCircle size={28} className="text-rose-400 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-rose-300 font-mono mb-1">
              {this.props.label ? `${this.props.label} crashed` : "Something went wrong"}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono mb-4 break-words">
              {this.state.error?.message ?? "An unexpected error occurred"}
            </p>
            <button
              onClick={this.retry}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg bg-rose-900/40 border border-rose-500/40 text-rose-300 text-xs font-mono hover:bg-rose-900/60 transition-colors"
            >
              <RefreshCw size={12} />
              Retry
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
