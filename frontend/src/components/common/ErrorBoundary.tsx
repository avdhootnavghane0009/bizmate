import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error in component tree:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-lg mx-auto my-12 bg-[#FFFFFF] dark:bg-[#20211D] border border-red-500/30 rounded-2xl shadow-xl text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-500 flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 className="text-base font-bold text-[#181915] dark:text-[#EDE8DE]">
            {this.props.fallbackTitle || 'Something went wrong on this page'}
          </h2>
          <p className="text-xs text-[#57554F] dark:text-[#9E998E]">
            {this.state.error?.message || 'An unexpected error occurred while rendering this module.'}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 bg-[#A0815A] hover:bg-[#8C6F4B] text-white rounded-lg text-xs font-bold inline-flex items-center gap-1.5 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
