import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

type Props = {
  children: ReactNode;
};

type State = {
  hasError: boolean;
  message: string;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    let msg = error.message || 'An unexpected error occurred.';
    try {
      const parsed = JSON.parse(msg) as { error?: string };
      if (parsed?.error) msg = parsed.error;
    } catch {
      // plain error message
    }
    return { hasError: true, message: msg };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Application ErrorBoundary caught:', error, errorInfo);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen bg-[#F5F7FA] dark:bg-[var(--dark-canvas)] text-[#08246B] dark:text-white flex items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[var(--dark-surface)] border border-[#DDE4EA] dark:border-[var(--dark-border)] p-6 space-y-4 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#FFF0E6] dark:bg-[#FF6A00]/15 text-[#FF6A00] flex items-center justify-center mx-auto">
            <AlertTriangle size={22} />
          </div>
          <div className="space-y-1">
            <h1 className="text-lg font-bold text-[#08246B] dark:text-white">
              Something went wrong
            </h1>
            <p className="text-xs text-[#4B5563] dark:text-[var(--dark-text-secondary)] break-words">
              {this.state.message}
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF6A00] hover:bg-[#E65F00] text-xs font-semibold text-white inline-flex items-center gap-2 whitespace-nowrap"
          >
            <RotateCcw size={15} />
            Reload app
          </button>
        </div>
      </div>
    );
  }
}
