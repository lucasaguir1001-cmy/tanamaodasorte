import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MockDatabase } from '../../services/mockData';
import { AffiliateService } from '../../services/affiliateService';
import { SystemNotification } from '../../types';
import { Bell, LogOut, User, ShieldCheck, CheckCheck, Download } from 'lucide-react';

export const Header: React.FC = () => {
  const { currentUser, currentAffiliate, logout } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<SystemNotification[]>([]);
  const [showNotifMenu, setShowNotifMenu] = useState(false);
  const notifRef = useRef<HTMLDivElement>(null);

  const loadNotifications = () => {
    if (!currentUser) return;
    const all = MockDatabase.getNotifications();
    const userNotifs = all.filter(n => n.userId === currentUser.uid || currentUser.role === 'admin');
    setNotifications(userNotifs);
  };

  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 5000);
    return () => clearInterval(interval);
  }, [currentUser]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAllRead = () => {
    if (currentUser) {
      AffiliateService.markAllNotificationsRead(currentUser.uid);
      loadNotifications();
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/afiliados/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-md border-b border-emerald-900/40 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Logo & Brand */}
          <Link to="/afiliados" className="flex items-center gap-2.5 sm:gap-3 group">
            <div className="relative flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-green-800 shadow-lg shadow-emerald-500/25 border border-emerald-300/30 shrink-0 group-hover:scale-105 transition-transform">
              <span className="text-xl sm:text-2xl select-none">🍀</span>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping opacity-75" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-base sm:text-2xl tracking-tight bg-gradient-to-r from-emerald-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  Tá Na Mão da SORTE
                </h1>
                <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                  Afiliados
                </span>
              </div>
              <p className="text-[10px] sm:text-xs text-emerald-300/70 font-medium hidden sm:block">
                Bingo &amp; Loteria Digital • Sorteios Diários às 19h • R$ 2,00 a Milhar
              </p>
            </div>
          </Link>

          {/* Action / User Bar */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão Instalar App Afiliados */}
            <button
              onClick={() => {
                if (window.triggerAfiliadosPwaInstall) {
                  window.triggerAfiliadosPwaInstall();
                }
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs shadow-md shadow-amber-500/20 active:scale-95 transition-all cursor-pointer"
              title="Instalar Aplicativo de Afiliados no Celular"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Instalar App</span>
            </button>

            {currentUser ? (
              <>
                {/* Notification Dropdown */}
                <div className="relative" ref={notifRef}>
                  <button
                    onClick={() => setShowNotifMenu(!showNotifMenu)}
                    className="relative p-2 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500/40 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Notificações"
                  >
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 w-5 h-5 bg-gradient-to-r from-amber-400 to-amber-600 text-slate-950 font-black text-[10px] rounded-full flex items-center justify-center shadow-md animate-bounce">
                        {unreadCount}
                      </span>
                    )}
                  </button>

                  {/* Notification Popup */}
                  {showNotifMenu && (
                    <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-slate-900 border border-emerald-500/30 rounded-2xl shadow-2xl shadow-emerald-950/80 overflow-hidden z-50">
                      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950/60">
                        <span className="text-xs font-bold text-white flex items-center gap-1.5">
                          <Bell className="w-4 h-4 text-emerald-400" /> Notificações
                        </span>
                        {unreadCount > 0 && (
                          <button
                            onClick={handleMarkAllRead}
                            className="text-[11px] text-emerald-400 hover:text-emerald-300 font-bold flex items-center gap-1 cursor-pointer"
                          >
                            <CheckCheck className="w-3.5 h-3.5" /> Marcar todas como lidas
                          </button>
                        )}
                      </div>

                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-800/60">
                        {notifications.length === 0 ? (
                          <div className="p-6 text-center text-xs text-slate-400">
                            Nenhuma notificação no momento.
                          </div>
                        ) : (
                          notifications.slice(0, 6).map(n => (
                            <div
                              key={n.id}
                              className={`p-3.5 transition-colors ${
                                !n.isRead ? 'bg-emerald-950/20' : 'hover:bg-slate-800/40'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <h4 className="text-xs font-bold text-white">{n.title}</h4>
                                <span className="text-[10px] text-slate-500 shrink-0">
                                  {new Date(n.createdAt).toLocaleDateString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">
                                {n.message}
                              </p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* User Info Capsule */}
                <div className="flex items-center gap-2 bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-1 pr-3">
                  <div className="w-7 h-7 rounded-lg bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-xs uppercase">
                    {currentUser.role === 'admin' ? (
                      <ShieldCheck className="w-4 h-4" />
                    ) : (
                      currentAffiliate?.fullName?.charAt(0) || <User className="w-4 h-4" />
                    )}
                  </div>
                  <div className="hidden sm:block text-left">
                    <p className="text-xs font-bold text-white truncate max-w-[130px]">
                      {currentUser.role === 'admin' ? 'Administrador' : currentAffiliate?.fullName?.split(' ')[0]}
                    </p>
                    <p className="text-[10px] text-emerald-400 font-mono">
                      {currentUser.role === 'admin' ? 'Master' : currentAffiliate?.exclusiveCode}
                    </p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors ml-1 cursor-pointer"
                    title="Sair da conta"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  to="/afiliados/login"
                  className="px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-bold text-emerald-400 hover:text-emerald-300 transition-colors"
                >
                  Entrar
                </Link>
                <Link
                  to="/afiliados/cadastro"
                  className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600 hover:from-emerald-300 hover:to-green-500 text-slate-950 shadow-md shadow-emerald-500/30 transition-all transform active:scale-95"
                >
                  Quero ser Afiliado
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
