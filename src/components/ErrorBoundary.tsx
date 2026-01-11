import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
    children: ReactNode;
    fallback?: ReactNode;
}

interface State {
    hasError: boolean;
    error?: Error;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    private handleRetry = () => {
        this.setState({ hasError: false, error: undefined });
    };

    public render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return (
                <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-4">
                    <AlertTriangle className="h-12 w-12 text-destructive" />
                    <h2 className="text-xl font-semibold text-center">حدث خطأ غير متوقع</h2>
                    <p className="text-muted-foreground text-center text-sm max-w-md">
                        عفواً، حدث خطأ أثناء تحميل الصفحة. يرجى المحاولة مرة أخرى.
                    </p>
                    <div className="flex gap-2 mt-2">
                        <Button onClick={this.handleRetry} variant="outline">
                            <RefreshCw className="h-4 w-4 mr-2" />
                            حاول مرة أخرى
                        </Button>
                        <Button onClick={() => window.location.reload()}>
                            تحديث الصفحة
                        </Button>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
