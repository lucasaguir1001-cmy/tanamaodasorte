import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { TrackingService } from './services/trackingService';

// Public Pages
import { LandingPage } from './pages/public/LandingPage';
import { RegisterPage } from './pages/public/RegisterPage';
import { LoginPage } from './pages/public/LoginPage';

// Affiliate Dashboard Pages
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { DashboardHome } from './pages/dashboard/DashboardHome';
import { MyLinksPage } from './pages/dashboard/MyLinksPage';
import { MaterialsPage } from './pages/dashboard/MaterialsPage';
import { ReportsPage } from './pages/dashboard/ReportsPage';
import { CommissionsPage } from './pages/dashboard/CommissionsPage';
import { ProfilePage } from './pages/dashboard/ProfilePage';
import { SubAffiliatesPage } from './pages/dashboard/SubAffiliatesPage';

// Admin Pages
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminAffiliates } from './pages/admin/AdminAffiliates';
import { AdminPayouts } from './pages/admin/AdminPayouts';
import { AdminMaterials } from './pages/admin/AdminMaterials';
import { AdminSettings } from './pages/admin/AdminSettings';
import { AdminAuditLogs } from './pages/admin/AdminAuditLogs';
import { PwaInstallPrompt } from './components/common/PwaInstallPrompt';

export const App: React.FC = () => {
  useEffect(() => {
    // Automatically capture ?afiliado= or ?ref= parameter and initialize 30-day attribution cookie
    TrackingService.initUrlTracking();
  }, []);

  return (
    <AuthProvider>
      <PwaInstallPrompt />
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Navigate to="/afiliados" replace />} />
          <Route path="/afiliados" element={<LandingPage />} />
          <Route path="/area-do-afiliado" element={<LandingPage />} />
          <Route path="/afiliados/cadastro" element={<RegisterPage />} />
          <Route path="/afiliados/login" element={<LoginPage />} />

          {/* Affiliate Dashboard Routes */}
          <Route
            path="/afiliados/dashboard"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <DashboardHome />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/subafiliados"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <SubAffiliatesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/links"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <MyLinksPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/materiais"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <MaterialsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/relatorios"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/comissoes"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <CommissionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/perfil"
            element={
              <ProtectedRoute requiredRole="affiliate">
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Admin Routes */}
          <Route
            path="/afiliados/admin"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminDashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/admin/afiliados"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminAffiliates />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/admin/saques"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminPayouts />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/admin/materiais"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminMaterials />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/admin/configuracoes"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/afiliados/admin/logs"
            element={
              <ProtectedRoute requiredRole="admin">
                <AdminAuditLogs />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/afiliados" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
