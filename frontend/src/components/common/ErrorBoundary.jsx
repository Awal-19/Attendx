import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '', showDetails: false };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error',
    };
  }

  componentDidCatch(error, info) {
    console.error('AttendX ErrorBoundary caught an error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[100dvh] w-full flex items-center justify-center bg-[#061430] px-4 py-10 text-white">
          <div className="w-full max-w-md rounded-3xl bg-white/10 border border-white/20 backdrop-blur-xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
            <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-red-500/20 border border-red-400/40">
              <AlertCircle className="w-7 h-7 text-red-300" />
            </div>
            <h1 className="text-xl font-extrabold">
              This attendance link couldn&apos;t be opened. Try scanning again
            </h1>
            {(import.meta.env.DEV || this.state.showDetails) && (
              <p className="text-xs text-blue-100/80 break-words bg-black/30 p-3 rounded-xl">
                {this.state.errorMessage}
              </p>
            )}
            {!import.meta.env.DEV && (
              <button
                type="button"
                onClick={() => this.setState((prev) => ({ showDetails: !prev.showDetails }))}
                className="text-xs text-blue-200/80 underline cursor-pointer"
              >
                {this.state.showDetails ? 'Hide Details' : 'Details'}
              </button>
            )}
            <div className="flex flex-col gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="w-full min-h-[48px] px-4 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reload Page</span>
              </button>
              <a
                href="/student/dashboard"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-xs inline-flex items-center justify-center"
              >
                Go to Dashboard
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

