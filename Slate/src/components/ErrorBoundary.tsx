import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("Uncaught error captured by ErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center p-8 min-h-[400px] w-full bg-white dark:bg-brand-900 border border-slate-200 dark:border-brand-800 rounded-3xl shadow-sm text-center animate-in fade-in duration-300">
          <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center text-rose-500 dark:text-rose-400 mx-auto mb-4 border border-rose-100 dark:border-rose-900/40 shadow-inner">
            <AlertTriangle size={32} />
          </div>
          <h3 className="text-base font-extrabold text-slate-800 dark:text-slate-200 mb-1.5">
            {this.props.fallbackTitle || 'Something went wrong'}
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-450 max-w-md mx-auto leading-relaxed mb-6">
            An unexpected error occurred while rendering this section. Try reloading or resetting the view.
          </p>

          {/* Collapsible Technical Details */}
          {this.state.error && (
            <div className="w-full max-w-md mx-auto mb-6 text-left">
              <details className="bg-slate-50 dark:bg-brand-950 border border-slate-200 dark:border-brand-850 rounded-2xl p-4 cursor-pointer group">
                <summary className="text-[10px] font-black uppercase tracking-wider text-slate-450 dark:text-slate-500 select-none outline-none">
                  Technical Details
                </summary>
                <div className="mt-3 text-[10px] font-mono text-rose-600 dark:text-rose-400 bg-white dark:bg-brand-900 border border-slate-100 dark:border-brand-800 p-3 rounded-xl overflow-x-auto whitespace-pre-wrap leading-normal shadow-inner max-h-40">
                  {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-brand-800 opacity-80 text-slate-650 dark:text-slate-400">
                      {this.state.errorInfo.componentStack}
                    </div>
                  )}
                </div>
              </details>
            </div>
          )}

          <div className="flex justify-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="flex items-center gap-1.5"
            >
              <RefreshCw size={14} /> Reload Page
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={this.handleReset}
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
