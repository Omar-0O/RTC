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
    isOfflineError?: boolean;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        retryCount: 0,
        isOfflineError: false
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
            // Check if offline to prevent destroying cache and page bricking
            if (!navigator.onLine) {
                console.warn('Chunk loading error caught while offline. Rendering fallback without auto-reload.');
                this.setState({ isOfflineError: true });
                return;
            }

            console.log('Chunk loading error detected, attempting auto-recovery...');

            // Build cleanup tasks and await them before reloading
            const cleanupTasks: Promise<unknown>[] = [];

            if ('caches' in window) {
                cleanupTasks.push(
                    caches.keys().then(names =>
                        Promise.all(names.map(name => caches.delete(name)))
                    )
                );
            }

            // Wait for cleanup (max 3 seconds), then reload
            Promise.race([
                Promise.allSettled(cleanupTasks),
                new Promise(resolve => setTimeout(resolve, 3000)),
            ]).then(() => {
                window.location.reload();
            });
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
        this.setState({ hasError: false, error: undefined, errorInfo: undefined, isOfflineError: false, retryCount: 0 });
    };

    private handleGoHome = () => {
        window.location.href = '/';
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            const isOffline = this.state.isOfflineError;
            const isChunkError = (this.state.error?.message.includes('Loading chunk') ||
                this.state.error?.message.includes('Failed to fetch dynamically imported module')) && !isOffline;

            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4 bg-background">
                    <AlertTriangle className="h-12 w-12 text-destructive animate-pulse" />
                    <h2 className="text-xl font-semibold text-center">
                        {isOffline ? 'أنت أوفلاين 📡' : 'ايرور او Update ايهمَ اقرب 3:'}
                    </h2>
                    <p className="text-muted-foreground text-center text-sm max-w-md">
                        {isOffline
                            ? 'مش قادرين نحمل الجزء ده من التطبيق عشان مفيش إنترنت. اتأكد من الاتصال وحاول تاني 🤍'
                            : (isChunkError
                                ? 'تم تحديث التطبيق. جاري إعادة التحميل تلقائياً...'
                                : 'ممكن تعمل ريفرش لوسمحت 🤍😇')}
                    </p>
                    {!isChunkError && (
                        <div className="flex gap-2 mt-2">
                            <Button onClick={isOffline ? this.handleRetry : () => window.location.reload()}>
                                <RefreshCw className="h-4 w-4 ltr:mr-2 rtl:ml-2" />
                                {isOffline ? 'إعادة المحاولة' : 'ريفرش'}
                            </Button>
                            <Button onClick={this.handleGoHome} variant="outline">
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
