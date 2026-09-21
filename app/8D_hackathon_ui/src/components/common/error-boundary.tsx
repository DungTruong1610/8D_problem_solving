import React from 'react';
import { Button } from '@cnma/react-ui';

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
}

/**
 * Global error boundary to catch unexpected render-time errors.
 * Wrap your route tree with this to prevent full app crashes.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('[ErrorBoundary] Caught error:', error, info);
    }

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) return this.props.fallback;

            return (
                <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 p-8 text-center">
                    <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                        <span className="text-destructive text-2xl font-bold">!</span>
                    </div>
                    <h2 className="text-xl font-semibold text-foreground">Something went wrong</h2>
                    <p className="text-muted-foreground max-w-md text-sm">
                        {this.state.error?.message ?? 'An unexpected error occurred. Please refresh the page.'}
                    </p>
                    <Button
                        className="h-9 text-sm font-semibold"
                        onClick={() => window.location.reload()}
                    >
                        Refresh Page
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}
