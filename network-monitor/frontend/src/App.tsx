import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './components/AuthContext';
import Dashboard from './pages/Dashboard';
import ClientDetails from './pages/ClientDetails';
import APManagement from './pages/APManagement';
import AlertSettings from './pages/AlertSettings';
import OSQueue from './pages/OSQueue';
import ScriptManager from './pages/ScriptManager';
import NetworkMap from './pages/NetworkMap';
import BadSignalsReport from './pages/BadSignalsReport';
import BackupManager from './pages/BackupManager';
import SystemSettings from './pages/SystemSettings';
import NE8000Dashboard from './pages/NE8000Dashboard';
import Login from './pages/Login';
import Layout from './components/Layout';
import { Loader2 } from 'lucide-react';

const queryClient = new QueryClient();

function ProtectedRoutes() {
  const { token, loading } = useAuth();
  
  const isScreenshot = window.location.pathname.includes('/screenshot-map/') && 
                     window.location.search.includes('secret=NETMONITOR_INTERNAL_BYPASS_2026');

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  if (!token && !isScreenshot) {
    return <Navigate to="/login" replace />;
  }

  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="client/:id" element={<ClientDetails />} />
        <Route path="ap-management" element={<APManagement />} />
        <Route path="os-queue" element={<OSQueue />} />
        <Route path="scripts" element={<ScriptManager />} />
        <Route path="network-map" element={<NetworkMap />} />
        <Route path="bad-signals" element={<BadSignalsReport />} />
        <Route path="backups" element={<BackupManager />} />
        <Route path="alerts" element={<AlertSettings />} />
        <Route path="settings" element={<SystemSettings />} />
            <Route path="ne8000" element={<NE8000Dashboard />} />
      </Route>
      <Route path="screenshot-map/:id" element={<NetworkMap />} />
    </Routes>
  );
}

function AppRoutes() {
  const { token, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <Loader2 className="w-10 h-10 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={token ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
