'use client';
import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card/60 px-6 py-20 text-center">
          <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-8 w-8" />
          </div>
          <h3 className="text-lg font-semibold">Something went wrong</h3>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            An unexpected error occurred while rendering this page. Try again or reload.
          </p>
          <div className="mt-5 flex gap-2">
            <Button onClick={() => this.setState({ hasError: false })}>Try again</Button>
            <Button variant="outline" onClick={() => window.location.reload()}>Reload</Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
