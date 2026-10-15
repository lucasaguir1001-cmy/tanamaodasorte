'use client';

import React from 'react';
import { 
  LogIn, 
  UserCheck, 
  LogOut, 
  Ticket, 
  HelpCircle,
  Download 
} from 'lucide-react';
import { Usuario } from '@/types';

interface HeaderProps {
  onOpenMyTickets: () => void;
  onOpenRules: () => void;
  onOpenLogin: () => void;
  onLogout?: () => void;
  myTicketsCount: number;
  currentUser: Usuario | null;
}

export const Header: React.FC<HeaderProps> = ({
  onOpenMyTickets,
  onOpenRules,
  onOpenLogin,
  onLogout,
  myTicketsCount,
  currentUser
}) => {
  const [isInstalled, setIsInstalled] = React.useState(false);

  React.useEffect(() => {
    const checkInstalled = () => {
      if (typeof window === 'undefined') return;
      const installed =
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://') ||
        window.location.search.includes('source=pwa') ||
        localStorage.getItem('pwa_app_installed') === 'true';

      if (installed) {
        setIsInstalled(true);
      }
    };

    checkInstalled();
    window.addEventListener('appinstalled', checkInstalled);
    return () => window.removeEventListener('appinstalled', checkInstalled);
  }, []);
  return (
    <header className="sticky top-0 z-40 w-full bg-slate-950/95 backdrop-blur-md border-b border-emerald-900/40 text-white">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-15 sm:h-20">
          
          {/* Logo e Nome */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="relative flex items-center justify-center w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-400 via-emerald-600 to-green-800 shadow-lg shadow-emerald-500/25 border border-emerald-300/30 shrink-0">
              <span className="text-xl sm:text-3xl select-none">🍀</span>
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full animate-ping opacity-75" />
            </div>

            <div>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <h1 className="font-extrabold text-base sm:text-2xl tracking-tight bg-gradient-to-r from-emerald-300 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                  Tá Na Mão da SORTE
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-emerald-300/70 font-medium hidden sm:block">
                Bingo &amp; Loteria Digital • Sorteios Diários às 19h • R$ 2,00 a Milhar
              </p>
            </div>
          </div>

          {/* Ações e Navegação */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Botão ENTRAR no lugar do antigo Sorteio 19h */}
            {!currentUser ? (
              <button
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 px-3 py-1.5 sm:px-4 sm:py-2 rounded-xl text-xs sm:text-sm font-black bg-gradient-to-r from-emerald-400 via-emerald-500 to-green-600 hover:from-emerald-300 hover:to-green-500 text-slate-950 shadow-md shadow-emerald-500/30 transition-all transform active:scale-95 cursor-pointer"
                title="Entrar com Nome, CPF e WhatsApp para escolher seus números"
              >
                <LogIn className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-slate-950 stroke-[2.5]" />
                <span>Entrar</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 bg-emerald-950/70 border border-emerald-500/40 rounded-xl p-1 pr-2">
                <button
                  onClick={onOpenLogin}
                  className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-emerald-300 hover:text-white transition-colors cursor-pointer"
                  title="Ver ou editar meus dados de participante"
                >
                  <div className="w-5 h-5 rounded-full bg-emerald-500 text-slate-950 flex items-center justify-center font-black text-[10px] uppercase">
                    {currentUser.nome_completo.charAt(0)}
                  </div>
                  <span className="max-w-[85px] sm:max-w-[120px] truncate">
                    {currentUser.nome_completo.split(' ')[0]}
                  </span>
                </button>
                {onLogout && (
                  <button
                    onClick={onLogout}
                    className="p-1 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-900 transition-colors cursor-pointer"
                    title="Sair / Trocar de participante"
                  >
                    <LogOut className="w-3 h-3" />
                  </button>
                )}
              </div>
            )}

            {/* Meus Bilhetes */}
            <button
              onClick={onOpenMyTickets}
              className="flex relative items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-semibold bg-emerald-950/80 hover:bg-emerald-900/80 text-emerald-200 border border-emerald-700/50 transition-colors"
              title="Ver meus bilhetes comprados"
            >
              <Ticket className="w-4 h-4 text-emerald-400" />
              <span className="hidden sm:inline">Meus Bilhetes</span>
              {myTicketsCount > 0 && (
                <span className="inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold bg-emerald-500 text-slate-950 rounded-full">
                  {myTicketsCount}
                </span>
              )}
            </button>

            {/* Regras (Como Funciona) */}
            <button
              onClick={onOpenRules}
              className="p-2 sm:px-2.5 sm:py-2 rounded-xl text-xs font-semibold bg-slate-900/80 hover:bg-slate-800 text-slate-300 border border-slate-700/50 transition-colors flex items-center gap-1"
              title="Como Funciona / Regras"
            >
              <HelpCircle className="w-4 h-4 text-amber-400" />
              <span className="hidden md:inline">Regras</span>
            </button>

            {/* Instalar Aplicativo (PWA) - Oculta automaticamente se já estiver instalado */}
            {!isInstalled && (
              <button
                onClick={() => {
                  if (typeof window !== 'undefined' && window.triggerPwaInstall) {
                    window.triggerPwaInstall();
                  }
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 rounded-xl text-xs sm:text-sm font-bold bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/50 transition-colors shadow-sm cursor-pointer"
                title="Instalar Aplicativo Oficial no Celular ou Computador"
              >
                <Download className="w-3.5 h-3.5 text-amber-400 stroke-[2.5]" />
                <span className="hidden sm:inline">Instalar App</span>
                <span className="sm:hidden text-[11px]">App</span>
              </button>
            )}

          </div>

        </div>
      </div>
    </header>
  );
};
