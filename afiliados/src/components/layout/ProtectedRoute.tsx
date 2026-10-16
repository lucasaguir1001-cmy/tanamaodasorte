import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from './Header';
import { Footer } from './Footer';
import { Sidebar } from './Sidebar';
import { AdminSidebar } from './AdminSidebar';
import { AlertTriangle, Clock, ShieldX } from 'lucide-react';
import { Button } from '../common/Button';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRole?: 'affiliate' | 'admin';
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRole
}) => {
  const { currentUser, currentAffiliate, isLoading, logout } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-emerald-400">
        <div className="w-10 h-10 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-300">Carregando painel Tá na Mão da Sorte...</p>
      </div>
    );
  }

  // Not logged in
  if (!currentUser) {
    return <Navigate to="/afiliados/login" replace />;
  }

  // Check Admin role requirement
  if (requiredRole === 'admin' && currentUser.role !== 'admin') {
    return <Navigate to="/afiliados/dashboard" replace />;
  }

  // Handle Affiliate account statuses (if accessing affiliate area)
  if (currentUser.role === 'affiliate' && currentAffiliate) {
    if (currentAffiliate.status === 'suspenso' || currentAffiliate.status === 'recusado') {
      return (
        <div className="min-h-screen flex flex-col bg-slate-950">
          <Header />
          <main className="flex-1 max-w-xl mx-auto px-4 py-16 flex items-center justify-center">
            <div className="bg-slate-900 border border-red-500/40 rounded-3xl p-8 text-center shadow-2xl shadow-red-950/40">
              <div className="w-16 h-16 rounded-2xl bg-red-500/20 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/30">
                <ShieldX className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black text-white mb-2">Conta {currentAffiliate.status === 'suspenso' ? 'Suspensa' : 'Não Aprovada'}</h2>
              <p className="text-sm text-slate-300 leading-relaxed mb-4">
                {currentAffiliate.rejectionReason || 'Sua conta de afiliado foi desativada pelas diretrizes de segurança da plataforma.'}
              </p>
              <div className="flex justify-center gap-3 mt-6">
                <Button variant="ghost" onClick={logout}>
                  Sair
                </Button>
                <a
                  href="https://wa.me/5511987654321"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold"
                >
                  Contatar Suporte
                </a>
              </div>
            </div>
          </main>
          <Footer />
        </div>
      );
    }
  }

  const isAdmin = currentUser.role === 'admin';

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />
      <div className="flex-1 flex flex-col lg:flex-row w-full max-w-7xl mx-auto">
        {isAdmin ? <AdminSidebar /> : <Sidebar />}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>
      <Footer />
    </div>
  );
};
