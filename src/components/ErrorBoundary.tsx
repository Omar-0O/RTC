import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
    errorInfo?: ErrorInfo;
    retryCount: number;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        retryCount: 0
    };

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);

        this.setState({ errorInfo });

        // Auto-recover from chunk loading errors (happens when app is updated)
        if (
            error.message.includes('Loading chunk') ||
            error.message.includes('Failed to fetch dynamically imported module') ||
            error.message.includes('Importing a module script failed') ||
            error.name === 'ChunkLoadError'
        ) {
            console.log('Chunk loading error detected, attempting auto-recovery...');

            // Clear any stale cache and reload
            if ('caches' in window) {
                caches.keys().then(names => {
                    names.forEach(name => caches.delete(name));
                });
            }

            // Auto-reload after a short delay
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            return;
        }

        // Auto-recover from network errors with retry
        if (
            error.message.includes('NetworkError') ||
            error.message.includes('Failed to fetch') ||
            error.message.includes('Network request failed')
        ) {
            if (this.state.retryCount < 3) {
                console.log(`Network error detected, auto-retrying... (attempt ${this.state.retryCount + 1}/3)`);
                setTimeout(() => {
                    this.setState(prev => ({
                        hasError: false,
                        error: undefined,
                        retryCount: prev.retryCount + 1
                    }));
                }, 2000);
                return;
            }
        }
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined, errorInfo: undefined });
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const isChunkError = this.state.error?.message.includes('Loading chunk') ||
                this.state.error?.message.includes('Failed to fetch dynamically imported module');

            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 bg-background">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <h2 className="text-xl font-semibold text-center">حدث خطأ غير متوقع</h2>
                    <p className="text-muted-foreground text-center text-sm max-w-md">
                        {isChunkError
                            ? 'تم تحديث التطبيق. جاري إعادة التحميل تلقائياً...'
                            : 'عفواً، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.'}
                    </p>
                    {!isChunkError && (
                        <div className="flex gap-2 mt-2">
                            <Button onClick={this.handleRetry} variant="outline">
                                <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                حاول مرة أخرى
                            </Button>
                            <Button onClick={() => window.location.reload()}>
                                تحديث الصفحة
                            </Button>
                            <Button onClick={this.handleGoHome} variant="ghost">
                                <Home className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                الرئيسية
                            </Button>
                        </div>
                    )}
                    {isChunkError && (
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary mt-4"></div>
                    )}
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
