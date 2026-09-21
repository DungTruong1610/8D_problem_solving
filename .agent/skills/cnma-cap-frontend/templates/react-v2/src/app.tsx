import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Toaster } from 'sonner';
import { MainLayout } from '@/components/layouts';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';
import { useFLPSyncDirect, getInitialFLPRoute } from '@/hooks/useFLPSync';
import { HomePage } from '@/pages/Home';

// Sync React Router navigation with parent FLP shell URL
function ShellSync() {
    useFLPSyncDirect();
    return null;
}

// Navigate to initial deep-link route from BTP Workzone on first load
function InitialRouteNavigator() {
    const navigate = useNavigate();
    const hasNavigated = useRef(false);

    useEffect(() => {
        if (hasNavigated.current) return;
        hasNavigated.current = true;

        const initialRoute = getInitialFLPRoute();
        if (initialRoute && initialRoute !== '/') {
            navigate(initialRoute, { replace: true });
        }
    }, [navigate]);

    return null;
}

export default function App() {
    return (
        <HashRouter>
            <ShellSync />
            <InitialRouteNavigator />
            <div className="min-h-screen bg-background">
                <ErrorBoundary>
                    <Routes>
                        <Route element={<MainLayout />}>
                            {/* ─── Application Routes ─── */}
                            <Route path="/" element={<HomePage />} />

                            {/*
                             * Add your routes here:
                             * <Route path="/your-page" element={<YourPage />} />
                             */}

                            <Route path="*" element={<Navigate to="/" replace />} />
                        </Route>
                    </Routes>
                </ErrorBoundary>
                <Toaster richColors closeButton />
            </div>
        </HashRouter>
    );
}
