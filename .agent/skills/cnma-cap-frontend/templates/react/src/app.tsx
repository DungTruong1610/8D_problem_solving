import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './presentation/layout/MainLayout';
import { WorklistPage } from './presentation/pages/Worklist/WorklistPage';
import { FioriThemeProvider } from './presentation/contexts/FioriThemeContext';
import { useFLPSyncDirect } from './presentation/hooks/useFLPSync';

// Note: Replace these with your actual pages
const DashboardPage = () => <div className="p-4">Dashboard (Not Implemented)</div>;
const SettingsPage = () => <div className="p-4">Settings (Not Implemented)</div>;

function AppContent() {
    useFLPSyncDirect(); // Sync URL with FLP

    return (
        <FioriThemeProvider>
            <MainLayout>
                <Routes>
                    <Route path="/" element={<WorklistPage />} />
                    <Route path="/dashboard" element={<DashboardPage />} />
                    <Route path="/settings" element={<SettingsPage />} />
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </MainLayout>
        </FioriThemeProvider>
    );
}

function App() {
    return (
        <HashRouter>
            <AppContent />
        </HashRouter>
    );
}

export default App;
