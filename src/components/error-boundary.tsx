"use client";

import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
  fallback?: ReactNode;
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
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="p-6 m-4 bg-red-50 text-red-900 border border-red-200 rounded-lg shadow-sm">
          <h2 className="text-lg font-bold mb-2">Đã xảy ra lỗi</h2>
          <p className="text-sm mb-4">
            Ứng dụng gặp sự cố khi hiển thị nội dung này. Vui lòng thử lại.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm font-medium"
          >
            Thử lại
          </button>
          <details className="mt-4 text-xs bg-red-100 p-2 rounded overflow-auto max-h-40">
            <summary className="font-semibold cursor-pointer">Chi tiết lỗi</summary>
            <pre className="mt-2 whitespace-pre-wrap">{this.state.error?.message}</pre>
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
