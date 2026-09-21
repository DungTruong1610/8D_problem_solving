import { HashRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { Toaster } from 'sonner';
import { MainLayout } from '@/components/layouts';
import { ErrorBoundary } from '@/components/common';
import { useFLPSyncDirect, getInitialFLPRoute } from '@/hooks/use-flpsync';

import {
    WorkflowPage,
    EightDListPage,
    EightDDetailPage,
    MasterDataPage,
} from '@/pages';
 
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
                            <Route path="/" element={<Navigate to="/8d" replace />} />
                            <Route path="/8d" element={<EightDListPage />} />
                            <Route path="/8d/:id" element={<EightDDetailPage />} />
                            <Route path="/master-data" element={<MasterDataPage />} />
                            <Route path="/workflow" element={<WorkflowPage />} />

                            <Route path="*" element={<Navigate to="/8d" replace />} />
                        </Route>
                    </Routes>
                </ErrorBoundary>
                <Toaster richColors closeButton />
            </div>
        </HashRouter>
    );
}

