import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Users,
  Link2,
  FolderOpen,
  BarChart3,
  Coins,
  UserCheck,
  ExternalLink
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export const Sidebar: React.FC = () => {
  const { currentAffiliate } = useAuth();

  const navItems = [
    { label: 'Visão Geral', path: '/afiliados/dashboard', icon: LayoutDashboard },
    { label: 'Afiliados', path: '/afiliados/subafiliados', icon: Users },
    { label: 'Meus Links', path: '/afiliados/links', icon: Link2 },
    { label: 'Materiais', path: '/afiliados/materiais', icon: FolderOpen },
    { label: 'Relatórios', path: '/afiliados/relatorios', icon: BarChart3 },
    { label: 'Comissões & Saque', path: '/afiliados/comissoes', icon: Coins },
    { label: 'Meu Perfil', path: '/afiliados/perfil', icon: UserCheck },
  ];

  return (
    <aside className="w-full lg:w-64 bg-slate-900/70 border-b lg:border-b-0 lg:border-r border-slate-800 p-4 shrink-0 flex lg:flex-col justify-between">
      <div className="w-full">
        {/* Navigation Menu */}
        <nav className="flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none">
          {navItems.map(item => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/afiliados/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-emerald-500/20 to-emerald-600/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
                  }`
                }
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* Affiliate Status Box at bottom (visible on desktop) */}
      {currentAffiliate && (
        <div className="hidden lg:block mt-6 pt-4 border-t border-slate-800/80">
          <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800 text-left">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Seu Código</span>
              <span className="text-xs font-mono font-extrabold text-amber-400">{currentAffiliate.exclusiveCode}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs">
              <span className="text-slate-400">Comissão:</span>
              <span className="font-extrabold text-emerald-400 font-mono">{(currentAffiliate.commissionRate * 100).toFixed(0)}%</span>
            </div>
          </div>

          <a
            href={`https://tanamaodasorte.com.br/?afiliado=${currentAffiliate.exclusiveCode}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 flex items-center justify-center gap-1.5 w-full py-2 px-3 text-xs font-bold text-slate-400 hover:text-emerald-400 bg-slate-900 hover:bg-slate-800 rounded-xl border border-slate-800 transition-colors"
          >
            <span>Ver Meu Link ao Vivo</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      )}
    </aside>
  );
};
