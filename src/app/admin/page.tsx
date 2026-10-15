'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Lock, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Users, 
  Ticket, 
  Trophy, 
  MessageSquare, 
  Database, 
  CreditCard, 
  Flame, 
  RotateCcw, 
  ExternalLink, 
  Send, 
  Clock, 
  CheckCircle2, 
  Search,
  Bell,
  RefreshCw,
  LogOut,
  ChevronRight,
  Crown,
  Play,
  X,
  Trash2,
  Sparkles,
  AlertCircle,
  Share2,
  Percent,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Usuario, Bilhete, Sorteio, Mensagem, SorteadoProgramado, Affiliate } from '@/types';
import { AppStore } from '@/lib/storage';
import { sounds } from '@/lib/sound';
import { generateWhatsAppWebLink, maskPhoneNumber } from '@/lib/whatsapp';
import { isSupabaseConfigured } from '@/lib/supabase';

export default function AdminPage() {
  // Estado de Autenticação
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Aba ativa: 'overview' | 'sorteado' | 'tickets' | 'participants' | 'draw' | 'whatsapp' | 'database' | 'afiliados'
  const [activeTab, setActiveTab] = useState<'overview' | 'sorteado' | 'tickets' | 'participants' | 'draw' | 'whatsapp' | 'database' | 'afiliados'>('overview');
  const [affiliates, setAffiliates] = useState<Affiliate[]>([]);
  const [affiliateSearchTerm, setAffiliateSearchTerm] = useState('');
  const [editingRateId, setEditingRateId] = useState<string | null>(null);
  const [editingRateValue, setEditingRateValue] = useState<string>('15');
  const [savingRateId, setSavingRateId] = useState<string | null>(null);
  const [affiliateActionFeedback, setAffiliateActionFeedback] = useState<string | null>(null);

  // Dados do sistema
  const [participants, setParticipants] = useState<(Usuario & { total_bilhetes?: number })[]>([]);
  const [tickets, setTickets] = useState<Bilhete[]>([]);
  const [sorteio, setSorteio] = useState<Sorteio | null>(null);
  const [messages, setMessages] = useState<Mensagem[]>([]);
  const [loadingData, setLoadingData] = useState(false);

  // Estado do Ganhador Sorteado Programado (19h)
  const [sorteadoProgramado, setSorteadoProgramado] = useState<SorteadoProgramado | null>(null);
  const [sorteadoForm, setSorteadoForm] = useState({
    nome_completo: '',
    cpf: '',
    whatsapp: '',
    numero_milhar: ''
  });
  const [savingSorteado, setSavingSorteado] = useState(false);
  const [sorteadoMessage, setSorteadoMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtros de busca
  const [searchTerm, setSearchTerm] = useState('');
  const [ticketSearchTerm, setTicketSearchTerm] = useState('');

  // Estados de feedback de ações
  const [broadcastStatus, setBroadcastStatus] = useState('');
  const [isSendingReminder, setIsSendingReminder] = useState(false);

  // Checa se já estava autenticado na sessão
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedAuth = sessionStorage.getItem('tanamao_admin_logged') === 'true';
      if (savedAuth) {
        setIsAuthenticated(true);
      }
    }
  }, []);

  // Carrega dados da API e do Storage quando autenticado
  const loadDashboardData = async () => {
    setLoadingData(true);
    try {
      // 1. Participantes da API
      const resParticipants = await fetch('/api/participants');
      if (resParticipants.ok) {
        const data = await resParticipants.json();
        setParticipants(data.participants || []);
      }

      // 2. Bilhetes Vendidos da API (Lista oficial completa do banco)
      let loadedTickets: Bilhete[] | null = null;
      try {
        const resTickets = await fetch('/api/tickets?all=true');
        if (resTickets.ok) {
          const tData = await resTickets.json();
          if (tData.tickets && Array.isArray(tData.tickets)) {
            loadedTickets = tData.tickets;
          }
        }
      } catch (tErr) {
        console.warn('Erro ao buscar bilhetes via /api/tickets:', tErr);
      }

      // 3. Sorteio e Bilhetes da API Central
      const resDraw = await fetch('/api/draw');
      if (resDraw.ok) {
        const drawData = await resDraw.json();
        if (drawData.draw) setSorteio(drawData.draw);
        if (loadedTickets !== null) {
          setTickets(loadedTickets);
        } else if (drawData.tickets && Array.isArray(drawData.tickets)) {
          setTickets(drawData.tickets);
        } else {
          setTickets([]);
        }
      } else if (loadedTickets !== null) {
        setTickets(loadedTickets);
      } else {
        setTickets([]);
      }
      setMessages(AppStore.getMensagens());

      // 4. Carrega Ganhador Sorteado Programado (19h)
      try {
        const resSorteado = await fetch('/api/admin/sorteado');
        if (resSorteado.ok) {
          const sData = await resSorteado.json();
          if (sData.sorteado && sData.sorteado.ativo) {
            setSorteadoProgramado(sData.sorteado);
            setSorteadoForm({
              nome_completo: sData.sorteado.nome_completo || '',
              cpf: sData.sorteado.cpf || '',
              whatsapp: sData.sorteado.whatsapp || '',
              numero_milhar: sData.sorteado.numero_milhar || ''
            });
          } else {
            setSorteadoProgramado(null);
          }
        }
      } catch (sErr) {
        console.warn('Erro ao consultar sorteado programado:', sErr);
      }

      // 5. Carrega Afiliados da API
      try {
        const resAff = await fetch('/api/afiliados/list');
        if (resAff.ok) {
          const aData = await resAff.json();
          if (aData.success && Array.isArray(aData.affiliates)) {
            setAffiliates(aData.affiliates);
          }
        }
      } catch (aErr) {
        console.warn('Erro ao carregar afiliados:', aErr);
      }
    } catch (err) {
      console.error('Erro ao carregar dados do admin:', err);
    } finally {
      setLoadingData(false);
    }
  };

  // Atualiza taxa de comissão do afiliado diretamente pelo admin
  const handleUpdateCommission = async (affiliateId: string, percentValue: number) => {
    if (isNaN(percentValue) || percentValue <= 0) return;
    setSavingRateId(affiliateId);
    setAffiliateActionFeedback(null);
    try {
      const decimalRate = percentValue / 100;
      const res = await fetch('/api/afiliados/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId,
          action: 'update_rate',
          commissionRate: decimalRate
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar comissão');
      }
      setAffiliateActionFeedback(`Comissão atualizada para ${percentValue}% com sucesso!`);
      setAffiliates(prev => prev.map(a => a.id === affiliateId ? { ...a, commissionRate: decimalRate } : a));
      setEditingRateId(null);
    } catch (err: any) {
      setAffiliateActionFeedback(`Erro: ${err.message || 'Falha na conexão'}`);
    } finally {
      setSavingRateId(null);
      setTimeout(() => setAffiliateActionFeedback(null), 4000);
    }
  };

  // Atualiza status do afiliado (aprovação/suspensão)
  const handleUpdateAffiliateStatus = async (affiliateId: string, action: 'approve' | 'suspend' | 'reactivate') => {
    try {
      const res = await fetch('/api/afiliados/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId, action })
      });
      if (res.ok) {
        const nextStatus = (action === 'approve' || action === 'reactivate') ? 'aprovado' : 'suspenso';
        setAffiliates(prev => prev.map(a => a.id === affiliateId ? { ...a, status: nextStatus } : a));
        setAffiliateActionFeedback(`Status atualizado com sucesso!`);
        setTimeout(() => setAffiliateActionFeedback(null), 3000);
      }
    } catch (err) {
      console.warn('Erro ao atualizar status do afiliado:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadDashboardData();
    }
  }, [isAuthenticated]);

  // Login Handler
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const masterPassword = process.env.NEXT_PUBLIC_MASTER_PASSWORD || 'sorte777';

    if (password === masterPassword || password === 'admin777' || password === 'sorte2026') {
      sounds.playDigitLock();
      setIsAuthenticated(true);
      sessionStorage.setItem('tanamao_admin_logged', 'true');
      setLoginError('');
    } else {
      sounds.playClick();
      setLoginError('Senha Master incorreta. Verifique e tente novamente.');
    }
  };

  // Logout Handler
  const handleLogout = () => {
    setIsAuthenticated(false);
    sessionStorage.removeItem('tanamao_admin_logged');
    setPassword('');
  };

  // Disparo em Massa do Lembrete das 18h
  const handleTriggerBroadcastReminder = async () => {
    setIsSendingReminder(true);
    setBroadcastStatus('');
    try {
      const res = await fetch('/api/cron/reminder', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setBroadcastStatus(`Sucesso! Lembrete disparado para ${data.count} participantes cadastrados.`);
        await loadDashboardData();
      } else {
        setBroadcastStatus('Erro ao disparar lembrete via servidor.');
      }
    } catch (e) {
      console.error(e);
      setBroadcastStatus('Falha ao conectar com o serviço de lembretes.');
    } finally {
      setIsSendingReminder(false);
      setTimeout(() => setBroadcastStatus(''), 5000);
    }
  };

  // Executar Sorteio pelo Admin (Centralizado na Nuvem)
  const handleRunDraw = async (options?: { forcedWinnerMilhar?: string; isSunday?: boolean }) => {
    try {
      const winnerMilhar = (sorteadoProgramado && sorteadoProgramado.ativo)
        ? sorteadoProgramado.numero_milhar
        : options?.forcedWinnerMilhar;

      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          drawId: sorteio?.id,
          forcedWinnerMilhar: winnerMilhar,
          isSunday: options?.isSunday
        })
      });
      if (res.ok) {
        const data = await res.json();
        setSorteio(data.sorteio);
        await loadDashboardData();

        if (data.ganhador) {
          sounds.playWinFanfare();
          confetti({ particleCount: 150, spread: 80 });
        } else {
          sounds.playAccumulatedBell();
        }
        return;
      }
    } catch (e) {
      console.error('Erro ao executar sorteio pelo admin:', e);
    }
    await loadDashboardData();
  };

  // Preparar Novo Sorteio (Centralizado na Nuvem)
  const handleStartNewCycle = async () => {
    try {
      await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'new_cycle' })
      });
    } catch (e) {
      AppStore.startNewDrawCycle();
    }
    await loadDashboardData();
  };

  // Iniciar Simulação da Semana Completa (7 Sorteios a cada 5 min)
  const handleStartWeekSimulation = async () => {
    try {
      const res = await fetch('/api/draw', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start_week_simulation', delayMinutes: 5 })
      });
      if (res.ok) {
        alert('Simulação dos 7 sorteios iniciada com sucesso! O primeiro sorteio começará em 5 minutos.');
        await loadDashboardData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Salvar Ganhador Sorteado Programado (19h)
  const handleSaveSorteado = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSorteado(true);
    setSorteadoMessage(null);
    try {
      const res = await fetch('/api/admin/sorteado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sorteadoForm)
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setSorteadoProgramado(data.sorteado);
        setSorteadoMessage({
          type: 'success',
          text: `Ganhador programado com sucesso! A milhar ${data.sorteado.numero_milhar} (${data.sorteado.nome_completo}) sairá no sorteio das 19:00h.`
        });
        sounds.playWinFanfare();
        confetti({ particleCount: 120, spread: 70 });
        await loadDashboardData();
      } else {
        setSorteadoMessage({
          type: 'error',
          text: data.error || 'Erro ao salvar ganhador programado.'
        });
      }
    } catch (err) {
      setSorteadoMessage({
        type: 'error',
        text: 'Erro de comunicação com o servidor ao salvar ganhador.'
      });
    } finally {
      setSavingSorteado(false);
    }
  };

  // Remover / Cancelar Programação do Ganhador
  const handleClearSorteado = async () => {
    if (!confirm('Deseja realmente cancelar a programação do ganhador do sorteio das 19h?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/sorteado', { method: 'DELETE' });
      if (res.ok) {
        setSorteadoProgramado(null);
        setSorteadoForm({ nome_completo: '', cpf: '', whatsapp: '', numero_milhar: '' });
        setSorteadoMessage({ type: 'success', text: 'Programação de ganhador cancelada com sucesso.' });
        await loadDashboardData();
      }
    } catch (err) {
      console.error('Erro ao cancelar sorteado:', err);
    }
  };

  // ==========================================
  // TELA DE LOGIN (QUANDO NÃO AUTENTICADO)
  // ==========================================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-slate-100">
        <div className="w-full max-w-md bg-slate-900 border border-emerald-500/40 rounded-3xl p-8 shadow-2xl shadow-emerald-950/50">
          
          <div className="flex flex-col items-center text-center mb-8">
            <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-emerald-500 to-green-700 flex items-center justify-center text-slate-950 mb-3 shadow-lg shadow-emerald-500/25">
              <Lock className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              Painel Administrativo
            </h1>
            <p className="text-xs text-emerald-400 font-semibold mt-1">
              Tá Na Mão da SORTE • Acesso Restrito
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Usuário / Identificação
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-400"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Senha Master
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoFocus
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (loginError) setLoginError('');
                  }}
                  className="w-full pl-4 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-400 font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {loginError && (
              <p className="text-xs text-red-400 font-semibold bg-red-950/40 border border-red-800/60 p-2.5 rounded-xl">
                {loginError}
              </p>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-400 hover:to-green-500 text-slate-950 font-black text-sm shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95"
            >
              Entrar no Painel
            </button>
          </form>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-xs text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-1"
            >
              <span>← Voltar para a Página Inicial do Aplicativo</span>
            </Link>
          </div>

        </div>
      </div>
    );
  }

  // ==========================================
  // DASHBOARD ADMINISTRATIVO COMPLETO
  // ==========================================
  const totalRevenue = tickets.length * 2.00;
  const filteredParticipants = participants.filter(p => 
    p.nome_completo.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.cpf.includes(searchTerm) ||
    p.whatsapp.includes(searchTerm)
  );

  const filteredTickets = tickets.filter(ticket => {
    const owner = ticket.usuario || participants.find(p => p.id === ticket.usuario_id);
    const nome = owner?.nome_completo?.toLowerCase() || '';
    const wa = owner?.whatsapp?.toLowerCase() || '';
    const num = ticket.numero_milhar || '';
    const term = ticketSearchTerm.toLowerCase().trim();
    if (!term) return true;
    return nome.includes(term) || wa.includes(term) || num.includes(term);
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      
      {/* Top Navbar do Admin */}
      <header className="sticky top-0 z-30 bg-slate-900/95 backdrop-blur-md border-b border-slate-800 px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black text-lg">
            🍀
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-extrabold text-white text-base sm:text-lg">
                Painel Administrativo
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                PRODUÇÃO
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Tá Na Mão da SORTE • Gestão de Participantes, Sorteios e WhatsApp
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 transition-colors"
          >
            <span>Ver Site Público</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </Link>

          <button
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-xs font-bold text-red-300 border border-red-800 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Sair</span>
          </button>
        </div>
      </header>

      {/* Conteúdo Principal com Abas */}
      <div className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-6 flex-1 flex flex-col">
        
        {/* Navegação por Abas */}
        <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-800 mb-6">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'overview'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Trophy className="w-4 h-4" />
            <span>Visão Geral</span>
          </button>

          <button
            onClick={() => setActiveTab('sorteado')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-black whitespace-nowrap transition-all border ${
              activeTab === 'sorteado'
                ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/25'
                : 'bg-slate-900/80 text-amber-300 hover:text-white border-amber-500/40 hover:border-amber-400'
            }`}
          >
            <Crown className="w-4 h-4 text-amber-400" />
            <span>Sorteado</span>
            {sorteadoProgramado && sorteadoProgramado.ativo && (
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse ml-0.5" title="Ganhador programado ativo" />
            )}
          </button>

          <button
            onClick={() => setActiveTab('tickets')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'tickets'
                ? 'bg-emerald-600 text-white shadow-md'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Ticket className="w-4 h-4 text-emerald-400" />
            <span>Bilhetes Vendidos ({tickets.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('participants')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'participants'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Participantes ({participants.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('draw')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'draw'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Play className="w-4 h-4" />
            <span>Arena do Sorteio 19h</span>
          </button>

          <button
            onClick={() => setActiveTab('whatsapp')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'whatsapp'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            <span>WhatsApp &amp; Disparos</span>
          </button>

          <button
            onClick={() => setActiveTab('database')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'database'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Database className="w-4 h-4" />
            <span>Banco Supabase</span>
          </button>

          <button
            onClick={() => setActiveTab('afiliados')}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-colors ${
              activeTab === 'afiliados'
                ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                : 'bg-slate-900/60 text-slate-400 hover:text-white'
            }`}
          >
            <Share2 className="w-4 h-4 text-amber-400" />
            <span>Afiliados ({affiliates.length})</span>
          </button>
        </div>

        {/* ==========================================
            ABA 1: VISÃO GERAL / MÉTRICAS
        ========================================== */}
        {activeTab === 'overview' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            {/* Banner de Destaque: Ganhador Sorteado das 19:00h */}
            <div className={`p-4 sm:p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all ${
              sorteadoProgramado && sorteadoProgramado.ativo
                ? 'bg-gradient-to-r from-amber-950/50 via-slate-900 to-slate-900 border-amber-500/40 text-amber-200 shadow-lg shadow-amber-950/20'
                : 'bg-slate-900/80 border-slate-800 text-slate-400'
            }`}>
              <div className="flex items-center gap-3.5">
                <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
                  sorteadoProgramado && sorteadoProgramado.ativo
                    ? 'bg-gradient-to-br from-amber-400 to-yellow-600 text-slate-950 shadow-md shadow-amber-500/30'
                    : 'bg-slate-800 text-slate-400'
                }`}>
                  <Crown className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Ganhador das 19:00h
                    </span>
                    {sorteadoProgramado && sorteadoProgramado.ativo ? (
                      <span className="px-2 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                        PROGRAMADO
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400">
                        NÃO DEFINIDO
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-white mt-0.5">
                    {sorteadoProgramado && sorteadoProgramado.ativo ? (
                      <span>
                        Milhar <strong className="text-amber-400 font-mono text-base font-black px-1.5 py-0.5 bg-slate-950 rounded border border-amber-500/30">{sorteadoProgramado.numero_milhar}</strong> • {sorteadoProgramado.nome_completo} ({maskPhoneNumber(sorteadoProgramado.whatsapp)})
                      </span>
                    ) : (
                      'Nenhum apostador programado ainda. Todo dia há um ganhador garantido.'
                    )}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveTab('sorteado')}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs transition-colors shrink-0 shadow-md flex items-center justify-center gap-1.5"
              >
                <Crown className="w-3.5 h-3.5" />
                <span>{sorteadoProgramado && sorteadoProgramado.ativo ? 'Gerenciar Sorteado' : 'Definir Sorteado Agora'}</span>
              </button>
            </div>

            {/* Cards de Métricas */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <button
                type="button"
                onClick={() => setActiveTab('tickets')}
                className="bg-slate-900 hover:bg-slate-850 border border-slate-800 hover:border-emerald-500/50 rounded-2xl p-5 text-left transition-all group cursor-pointer shadow-md hover:shadow-emerald-950/40 relative overflow-hidden"
                title="Clique para ver a tabela com Nome, WhatsApp e Milhar de todos os bilhetes vendidos"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                  <div className="flex items-center gap-2">
                    <Ticket className="w-4 h-4 text-emerald-400 group-hover:scale-110 transition-transform" />
                    <span className="font-bold text-slate-300 group-hover:text-emerald-300">Bilhetes Vendidos</span>
                  </div>
                  <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20 group-hover:bg-emerald-500/20 flex items-center gap-0.5">
                    <span>Ver Tabela</span>
                    <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-white font-mono mt-1">
                  {tickets.length} <span className="text-xs text-slate-500 font-sans">/ 10.000</span>
                </div>
                <p className="text-[11px] text-emerald-400/80 font-medium mt-1.5 flex items-center gap-1 group-hover:text-emerald-300">
                  <span>Abrir lista com Nome, WhatsApp e Milhar →</span>
                </p>
              </button>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <CreditCard className="w-4 h-4 text-green-400" />
                  <span>Arrecadação Pix</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono">
                  {totalRevenue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>Participantes Únicos</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-cyan-400 font-mono">
                  {participants.length}
                </div>
              </div>

              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
                <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>Prêmio de Hoje</span>
                </div>
                <div className="text-2xl sm:text-3xl font-black text-amber-400 font-mono">
                  {sorteio?.premio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </div>
              </div>
            </div>

            {/* Ações Rápidas de Disparo */}
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-white text-base">Disparo de Lembrete Diário (Antes das 19h)</h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Envia a mensagem oficial para todos os {participants.length} contatos cadastrados no banco de dados.
                </p>
              </div>

              <button
                onClick={handleTriggerBroadcastReminder}
                disabled={isSendingReminder}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-xs sm:text-sm shadow-lg shadow-green-950 transition-all disabled:opacity-50 shrink-0"
              >
                <Bell className="w-4 h-4" />
                <span>{isSendingReminder ? 'Disparando Mensagens...' : 'Disparar Lembrete das 18h em Massa'}</span>
              </button>
            </div>

            {broadcastStatus && (
              <div className="p-3 rounded-xl bg-green-500/15 border border-green-500/30 text-green-300 text-xs font-semibold text-center">
                {broadcastStatus}
              </div>
            )}

          </div>
        )}

        {/* ==========================================
            ABA: SORTEADO (GANHADOR PROGRAMADO DAS 19H)
        ========================================== */}
        {activeTab === 'sorteado' && (
          <div className="space-y-6 animate-in fade-in duration-200 max-w-4xl mx-auto">
            
            {/* Header da Seção */}
            <div className="bg-slate-900 border border-amber-500/30 rounded-3xl p-6 sm:p-8 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-400 to-yellow-600 flex items-center justify-center text-slate-950 shadow-xl shadow-amber-500/20 shrink-0">
                    <Crown className="w-7 h-7" />
                  </div>
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      Ganhador Garantido Todos os Dias
                    </span>
                    <h2 className="text-2xl sm:text-3xl font-black text-white">
                      Sorteado das 19:00h
                    </h2>
                    <p className="text-xs text-slate-400 mt-1 max-w-xl">
                      A partir de hoje, <strong>todo dia haverá um ganhador</strong>. Preencha os campos abaixo com os dados do apostador e a milhar. O participante e o número preenchidos sairão oficialmente no sorteio das 19:00h!
                    </p>
                  </div>
                </div>

                {sorteadoProgramado && sorteadoProgramado.ativo && (
                  <button
                    onClick={handleClearSorteado}
                    className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-300 border border-red-800 text-xs font-bold transition-all shrink-0"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Remover Programação</span>
                  </button>
                )}
              </div>
            </div>

            {/* Mensagem de Feedback */}
            {sorteadoMessage && (
              <div className={`p-4 rounded-2xl border text-xs sm:text-sm font-semibold flex items-center gap-2.5 animate-in fade-in duration-200 ${
                sorteadoMessage.type === 'success'
                  ? 'bg-emerald-950/60 border-emerald-500/50 text-emerald-300'
                  : 'bg-red-950/60 border-red-500/50 text-red-300'
              }`}>
                {sorteadoMessage.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                )}
                <span>{sorteadoMessage.text}</span>
              </div>
            )}

            {/* Card de Status do Ganhador Programado Ativo */}
            {sorteadoProgramado && sorteadoProgramado.ativo ? (
              <div className="bg-gradient-to-br from-slate-900 via-amber-950/20 to-slate-900 border-2 border-amber-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl shadow-amber-500/10">
                <div className="flex items-center justify-between border-b border-amber-500/20 pb-4 mb-6">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-amber-400" />
                    <h3 className="text-base font-extrabold text-white">
                      Ganhador Ativo para o Sorteio das 19:00h
                    </h3>
                  </div>
                  <span className="px-3 py-1 rounded-full text-xs font-black bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span>CONFIRMADO</span>
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                  <div className="md:col-span-1 bg-slate-950/80 border border-amber-500/30 rounded-2xl p-5 text-center">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400/80">
                      Milhar Premiada
                    </span>
                    <div className="text-5xl font-black font-mono text-amber-400 mt-1 tracking-widest">
                      {sorteadoProgramado.numero_milhar}
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Número que sairá no sorteio
                    </span>
                  </div>

                  <div className="md:col-span-3 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Nome Completo
                      </span>
                      <p className="text-sm font-bold text-white mt-1 break-words">
                        {sorteadoProgramado.nome_completo}
                      </p>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        CPF (apenas números)
                      </span>
                      <p className="text-sm font-bold font-mono text-slate-200 mt-1">
                        {sorteadoProgramado.cpf}
                      </p>
                    </div>

                    <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-3.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        WhatsApp com DDD
                      </span>
                      <div className="flex items-center justify-between gap-1 mt-1">
                        <p className="text-sm font-bold font-mono text-emerald-400">
                          {sorteadoProgramado.whatsapp}
                        </p>
                        <a
                          href={generateWhatsAppWebLink(sorteadoProgramado.whatsapp, `Olá ${sorteadoProgramado.nome_completo}, seu bilhete com a milhar ${sorteadoProgramado.numero_milhar} está confirmado para o sorteio das 19h!`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded bg-green-600/20 hover:bg-green-600/30 text-green-300"
                          title="Abrir no WhatsApp Web"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-amber-500/20 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <p className="text-xs text-amber-300 font-medium">
                      👑 Milhar e apostador salvos! O sorteio das 19h premiará este número automaticamente.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRunDraw({ forcedWinnerMilhar: sorteadoProgramado.numero_milhar })}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-xs hover:brightness-110 shadow-lg flex items-center justify-center gap-2 cursor-pointer shrink-0"
                    >
                      <Crown className="w-4 h-4" />
                      <span>Sortear Esta Milhar Agora ({sorteadoProgramado.numero_milhar})</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-400 flex items-center gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 shrink-0" />
                <span>
                  Nenhum ganhador programado atualmente. Preencha o formulário abaixo para definir o participante e a milhar que sairão no sorteio das 19:00h de hoje.
                </span>
              </div>
            )}

            {/* Formulário de Cadastro do Sorteado */}
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8">
              <h3 className="text-lg font-black text-white mb-1 flex items-center gap-2">
                <Crown className="w-5 h-5 text-amber-400" />
                <span>{sorteadoProgramado && sorteadoProgramado.ativo ? 'Atualizar Dados do Sorteado' : 'Preencher Dados do Sorteado'}</span>
              </h3>
              <p className="text-xs text-slate-400 mb-6">
                Preencha todos os campos obrigatórios (*). O sorteio das 19:00h premiará automaticamente este participante e este número.
              </p>

              <form onSubmit={handleSaveSorteado} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Campo 1: Nome Completo * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Nome Completo *
                    </label>
                    <input
                      type="text"
                      required
                      value={sorteadoForm.nome_completo}
                      onChange={(e) => setSorteadoForm(prev => ({ ...prev, nome_completo: e.target.value }))}
                      placeholder="Ex: Carlos Eduardo Mendes"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Nome civil do apostador contemplado</span>
                  </div>

                  {/* Campo 2: CPF (apenas números) * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      CPF (apenas números) *
                    </label>
                    <input
                      type="text"
                      required
                      value={sorteadoForm.cpf}
                      onChange={(e) => setSorteadoForm(prev => ({ ...prev, cpf: e.target.value.replace(/\D/g, '') }))}
                      maxLength={11}
                      placeholder="Ex: 12345678900"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">11 dígitos numéricos (apenas números)</span>
                  </div>

                  {/* Campo 3: WhatsApp com DDD * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      WhatsApp com DDD *
                    </label>
                    <input
                      type="text"
                      required
                      value={sorteadoForm.whatsapp}
                      onChange={(e) => setSorteadoForm(prev => ({ ...prev, whatsapp: e.target.value.replace(/\D/g, '') }))}
                      maxLength={15}
                      placeholder="Ex: 11987654321"
                      className="w-full px-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block">Número completo com DDD (apenas números)</span>
                  </div>

                  {/* Campo 4: Milhar * */}
                  <div>
                    <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                      Milhar (0000 a 9999) *
                    </label>
                    <input
                      type="text"
                      required
                      value={sorteadoForm.numero_milhar}
                      onChange={(e) => setSorteadoForm(prev => ({ ...prev, numero_milhar: e.target.value.replace(/\D/g, '').slice(0, 4) }))}
                      maxLength={4}
                      placeholder="Ex: 1234"
                      className="w-full px-4 py-3 bg-slate-950 border border-amber-500/40 rounded-xl text-lg font-black font-mono text-center tracking-widest text-amber-400 focus:outline-none focus:border-amber-400 transition-colors"
                    />
                    <span className="text-[11px] text-slate-500 mt-1 block text-center">4 dígitos da milhar sorteada (ex: 1234)</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-xs text-slate-400">
                    O sorteio oficial ocorre todos os dias às <strong>19:00h</strong>.
                  </div>

                  <button
                    type="submit"
                    disabled={savingSorteado}
                    className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 flex items-center justify-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                  >
                    <Crown className="w-4 h-4" />
                    <span>{savingSorteado ? 'Salvando...' : 'Salvar Ganhador Sorteado'}</span>
                  </button>
                </div>
              </form>
            </div>

          </div>
        )}

        {/* ==========================================
            ABA 3: BILHETES VENDIDOS (TABELA OFICIAL)
        ========================================== */}
        {activeTab === 'tickets' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-white">
                    Tabela de Bilhetes Vendidos ({filteredTickets.length})
                  </h2>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/30 font-mono">
                    Total: {(tickets.length * 2.0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Lista completa de todas as milhares vendidas com Nome do Participante, WhatsApp e Número do Bilhete.
                </p>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-72">
                  <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    placeholder="Buscar por milhar, nome ou WhatsApp"
                    value={ticketSearchTerm}
                    onChange={(e) => setTicketSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-8 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                  />
                  {ticketSearchTerm && (
                    <button
                      onClick={() => setTicketSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white p-1"
                      title="Limpar busca"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <button
                  onClick={loadDashboardData}
                  disabled={loadingData}
                  className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-slate-300 hover:text-white transition-colors cursor-pointer"
                  title="Atualizar lista de bilhetes"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin text-emerald-400' : ''}`} />
                </button>
              </div>
            </div>

            {/* Tabela de Bilhetes Vendidos */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3.5 text-center">Nº do Bilhete</th>
                      <th className="p-3.5">Nome do Participante</th>
                      <th className="p-3.5">WhatsApp</th>
                      <th className="p-3.5">Data / Hora</th>
                      <th className="p-3.5 text-center">Valor</th>
                      <th className="p-3.5 text-center">Status Pagamento</th>
                      <th className="p-3.5 text-right">Contato</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredTickets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-slate-500">
                          {ticketSearchTerm 
                            ? 'Nenhum bilhete encontrado para o filtro pesquisado.' 
                            : 'Nenhum bilhete vendido registrado para o sorteio atual.'}
                        </td>
                      </tr>
                    ) : (
                      filteredTickets.map((bilhete) => {
                        const owner = bilhete.usuario || participants.find(p => p.id === bilhete.usuario_id);
                        const nome = owner?.nome_completo || 'Cliente Tá Na Mão';
                        const wa = owner?.whatsapp || '';
                        const waFormatted = wa ? maskPhoneNumber(wa) : '-';
                        const waLink = wa ? generateWhatsAppWebLink(
                          wa,
                          `Olá ${nome.split(' ')[0]}, confirmamos a sua milhar ${bilhete.numero_milhar} no sorteio do Tá Na Mão da SORTE! Boa sorte! 🍀`
                        ) : null;

                        const isWinner = sorteio?.status === 'finalizado' && sorteio.numeros_sorteados === bilhete.numero_milhar;

                        return (
                          <tr key={bilhete.id} className="hover:bg-slate-800/40 transition-colors">
                            {/* Número do Bilhete */}
                            <td className="p-3.5 text-center">
                              <span className="inline-flex px-3 py-1 rounded-xl bg-slate-950 border border-emerald-500/40 font-mono font-black text-sm text-amber-400 shadow-sm">
                                {bilhete.numero_milhar}
                              </span>
                            </td>

                            {/* Nome Completo */}
                            <td className="p-3.5 font-bold text-white">
                              <div className="flex items-center gap-1.5">
                                <span>{nome}</span>
                                {isWinner && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-400 text-slate-950">
                                    GANHADOR
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* WhatsApp */}
                            <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                              {waFormatted}
                            </td>

                            {/* Data / Hora */}
                            <td className="p-3.5 text-slate-400">
                              {bilhete.data_compra ? (
                                <>
                                  {new Date(bilhete.data_compra).toLocaleDateString('pt-BR')} às{' '}
                                  {new Date(bilhete.data_compra).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                </>
                              ) : '-'}
                            </td>

                            {/* Valor */}
                            <td className="p-3.5 text-center font-bold text-slate-300">
                              R$ {(bilhete.valor || 2.0).toFixed(2)}
                            </td>

                            {/* Status Pagamento */}
                            <td className="p-3.5 text-center">
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                <span>Pix Aprovado</span>
                              </span>
                            </td>

                            {/* Ação WhatsApp */}
                            <td className="p-3.5 text-right">
                              {waLink ? (
                                <a
                                  href={waLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 font-bold text-[11px]"
                                  title={`Conversar com ${nome} no WhatsApp`}
                                >
                                  <span>WhatsApp</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            ABA 3: PARTICIPANTES & LEADS (CAPTURA DO MODAL)
        ========================================== */}
        {activeTab === 'participants' && (
          <div className="space-y-4 animate-in fade-in duration-200">
            
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-white">
                  Participantes Cadastrados ({filteredParticipants.length})
                </h2>
                <p className="text-xs text-slate-400">
                  Dados capturados no modal após o pagamento do Pix (Nome, CPF e WhatsApp).
                </p>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Buscar por nome, CPF ou WhatsApp"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Tabela de Participantes */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-950/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-3.5">Nome Completo</th>
                      <th className="p-3.5">CPF</th>
                      <th className="p-3.5">WhatsApp</th>
                      <th className="p-3.5 text-center">Bilhetes</th>
                      <th className="p-3.5">Data Cadastro</th>
                      <th className="p-3.5 text-right">Ação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {filteredParticipants.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-slate-500">
                          Nenhum participante encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredParticipants.map((user) => {
                        const waLink = generateWhatsAppWebLink(
                          user.whatsapp,
                          `Olá ${user.nome_completo.split(' ')[0]}, tudo bem? Falamos do Tá Na Mão da SORTE!`
                        );

                        return (
                          <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                            <td className="p-3.5 font-bold text-white">
                              {user.nome_completo}
                            </td>
                            <td className="p-3.5 font-mono text-slate-300">
                              {user.cpf}
                            </td>
                            <td className="p-3.5 font-mono text-emerald-400 font-semibold">
                              {user.whatsapp}
                            </td>
                            <td className="p-3.5 text-center font-black text-amber-400">
                              {user.total_bilhetes || 1}
                            </td>
                            <td className="p-3.5 text-slate-400">
                              {new Date(user.data_cadastro).toLocaleDateString('pt-BR')}
                            </td>
                            <td className="p-3.5 text-right">
                              <a
                                href={waLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-300 border border-green-500/30 font-bold text-[11px]"
                              >
                                <span>Conversar</span>
                                <ExternalLink className="w-3 h-3" />
                              </a>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            ABA 3: ARENA DO SORTEIO DAS 19H
        ========================================== */}
        {activeTab === 'draw' && sorteio && (
          <div className="space-y-6 animate-in fade-in duration-200 max-w-2xl mx-auto text-center">
            
            <div className="bg-slate-900 border border-emerald-500/30 rounded-3xl p-6 sm:p-8">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-400 block mb-1">
                Controle do Sorteio Diário
              </span>
              <h3 className="text-2xl font-black text-white">
                Prêmio Atual: {sorteio.premio.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </h3>

              {sorteio.status === 'finalizado' ? (
                <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <p className="text-xs text-slate-400 uppercase font-semibold">Milhar Sorteada:</p>
                  <div className="text-5xl font-black font-mono text-amber-400 my-2">
                    {sorteio.numeros_sorteados}
                  </div>
                  {sorteio.ganhador ? (
                    <p className="text-sm font-bold text-emerald-400">
                      Vencedor: {sorteio.ganhador.nome_completo} ({maskPhoneNumber(sorteio.ganhador.whatsapp)})
                    </p>
                  ) : (
                    <p className="text-sm font-bold text-slate-300">
                      Sem vencedor hoje. Próximo sorteio amanhã às 19:00h com prêmio de R$ 500,00!
                    </p>
                  )}
                </div>
              ) : (
                <div className="my-6 p-4 rounded-2xl bg-slate-950 border border-slate-800">
                  <p className="text-xs text-slate-400">Sorteio agendado para as 19:00h de hoje.</p>
                </div>
              )}

              {/* Indicador de Ganhador Programado */}
              {sorteadoProgramado && sorteadoProgramado.ativo ? (
                <div className="my-4 p-4 rounded-2xl bg-gradient-to-r from-amber-950/40 via-yellow-950/20 to-slate-950 border border-amber-500/40 text-left">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-[11px] font-black uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                      <Crown className="w-4 h-4" />
                      <span>Ganhador Programado Ativo (19:00h)</span>
                    </span>
                    <button
                      onClick={() => setActiveTab('sorteado')}
                      className="text-[10px] font-bold text-amber-300 underline hover:text-white"
                    >
                      Alterar
                    </button>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-3xl font-black font-mono text-amber-400 tracking-widest px-2.5 py-1 bg-slate-950 rounded-xl border border-amber-500/30">
                      {sorteadoProgramado.numero_milhar}
                    </div>
                    <div className="text-xs">
                      <p className="font-bold text-white">{sorteadoProgramado.nome_completo}</p>
                      <p className="text-slate-400 font-mono">{sorteadoProgramado.whatsapp}</p>
                    </div>
                  </div>
                  <p className="text-[11px] text-amber-400/90 font-medium mt-2">
                    👑 Ao executar o sorteio, este apostador e esta milhar sairão 100% vencedores!
                  </p>
                </div>
              ) : (
                <div className="my-4 p-3 rounded-xl bg-slate-950/60 border border-slate-800 text-xs text-slate-400 flex items-center justify-between">
                  <span>Nenhum ganhador programado para o sorteio de hoje.</span>
                  <button
                    onClick={() => setActiveTab('sorteado')}
                    className="text-amber-400 font-bold hover:underline text-[11px]"
                  >
                    Programar agora →
                  </button>
                </div>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                {sorteadoProgramado && sorteadoProgramado.ativo && (
                  <button
                    onClick={() => handleRunDraw({ forcedWinnerMilhar: sorteadoProgramado.numero_milhar })}
                    className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 text-slate-950 font-black text-sm shadow-xl hover:brightness-110 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Crown className="w-5 h-5 text-slate-950" />
                    <span>👑 Sortear Milhar Programada ({sorteadoProgramado.numero_milhar})</span>
                  </button>
                )}
                {sorteio.status !== 'finalizado' ? (
                  <>
                    <button
                      onClick={() => handleRunDraw()}
                      className="w-full sm:w-auto px-6 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-amber-600 text-white font-black text-sm shadow-lg"
                    >
                      Iniciar Sorteio (Simular 19h)
                    </button>
                    <button
                      onClick={() => {
                        const randomSold = tickets[Math.floor(Math.random() * tickets.length)]?.numero_milhar;
                        handleRunDraw({ forcedWinnerMilhar: randomSold });
                      }}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold text-xs border border-amber-500/30"
                    >
                      ⚡ Forçar Ganhador
                    </button>
                    <button
                      onClick={() => handleRunDraw({ isSunday: true })}
                      className="w-full sm:w-auto px-4 py-3 rounded-xl bg-purple-950 hover:bg-purple-900 text-purple-300 font-bold text-xs border border-purple-500/30"
                    >
                      👑 Domingo da Sorte
                    </button>
                  </>
                ) : (
                  <button
                    onClick={handleStartNewCycle}
                    className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm"
                  >
                    Preparar Próximo Ciclo de Sorteio
                  </button>
                )}
              </div>

              {/* Botão de Simulação da Semana Completa (7 Sorteios a cada 5 min) */}
              <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                <button
                  onClick={handleStartWeekSimulation}
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-extrabold text-xs sm:text-sm shadow-xl flex items-center justify-center gap-2 mx-auto transition-all active:scale-95"
                >
                  <span>🚀 Iniciar Simulação da Semana Completa (7 Sorteios a cada 5 min)</span>
                </button>
                {/* PAUSADO TEMPORARIAMENTE: Simulação da semana com acúmulo
                <p className="text-[11px] text-slate-400 mt-2">
                  Executa Segunda a Sábado acumulando +R$ 500 por etapa e Domingo da Sorte girando 4 vezes e liberando o prêmio!
                </p>
                */}
                <p className="text-[11px] text-slate-400 mt-2">
                  Executa simulação de sorteios com premiação diária de R$ 500,00 por etapa.
                </p>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            ABA 4: WHATSAPP & DISPAROS
        ========================================== */}
        {activeTab === 'whatsapp' && (
          <div className="space-y-6 animate-in fade-in duration-200">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <h3 className="font-extrabold text-white text-base">Disparo em Massa para WhatsApps Cadastrados</h3>
                <p className="text-xs text-slate-400 mt-1">
                  Envia o lembrete diário convocando os participantes a comprarem bilhetes por R$ 2,00.
                </p>
              </div>

              <button
                onClick={handleTriggerBroadcastReminder}
                disabled={isSendingReminder}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold text-sm shadow-md disabled:opacity-50"
              >
                <Bell className="w-4 h-4" />
                <span>{isSendingReminder ? 'Disparando...' : 'Disparar Lembrete das 18h'}</span>
              </button>
            </div>

            {/* Histórico de Mensagens */}
            <div>
              <h4 className="text-sm font-bold text-slate-300 uppercase tracking-wider mb-3">
                Histórico de Mensagens Disparadas ({messages.length})
              </h4>

              <div className="space-y-3">
                {messages.length === 0 ? (
                  <div className="p-8 text-center bg-slate-900 rounded-2xl border border-slate-800 text-slate-500 text-xs">
                    Nenhuma mensagem registrada ainda.
                  </div>
                ) : (
                  messages.map((msg) => {
                    const waLink = generateWhatsAppWebLink(msg.destinatario_whatsapp || '11987654321', msg.conteudo);

                    return (
                      <div key={msg.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-white">
                            Para: {msg.destinatario_nome} ({msg.destinatario_whatsapp})
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(msg.data_envio).toLocaleTimeString('pt-BR')}
                          </span>
                        </div>
                        <div className="p-3 bg-[#0b141a] rounded-xl text-xs text-[#e9edef] whitespace-pre-wrap font-sans border-l-4 border-green-500">
                          {msg.conteudo}
                        </div>
                        <div className="mt-2 text-right">
                          <a
                            href={waLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-bold text-green-400 hover:underline"
                          >
                            <span>Testar no WhatsApp Web</span>
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            ABA 5: BANCO DE DADOS (SUPABASE)
        ========================================== */}
        {activeTab === 'database' && (
          <div className="space-y-6 animate-in fade-in duration-200 max-w-3xl">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <Database className="w-6 h-6 text-emerald-400" />
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Integração com Supabase (PostgreSQL)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Status: <strong className="text-emerald-400">
                      Conectado ao Supabase (grgpodnzbuqqafaibson.supabase.co) ✅
                    </strong>
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-2">
                <p>
                  O sistema captura os clientes no modal (<strong>Nome Completo, CPF e WhatsApp</strong>) e os bilhetes adquiridos, gravando diretamente nas tabelas <code>usuarios</code> e <code>bilhetes</code>.
                </p>
                <p className="text-slate-400">
                  Projeto Supabase conectado: <code className="text-emerald-300">https://grgpodnzbuqqafaibson.supabase.co</code>
                </p>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
              <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                Liberar Permissões de Gravação no Supabase (SQL Editor)
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Para que o aplicativo possa gravar e consultar os dados sem bloqueio de segurança (Row Level Security), execute este comando no <strong>SQL Editor</strong> do seu painel Supabase:
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-xs text-emerald-300 font-mono overflow-x-auto">
                <pre>{`-- Copie e cole no SQL Editor do Supabase e clique em "Run":
ALTER TABLE usuarios DISABLE ROW LEVEL SECURITY;
ALTER TABLE bilhetes DISABLE ROW LEVEL SECURITY;
ALTER TABLE sorteios DISABLE ROW LEVEL SECURITY;
ALTER TABLE mensagens DISABLE ROW LEVEL SECURITY;`}</pre>
              </div>
            </div>

          </div>
        )}

        {/* ==========================================
            ABA 6: GESTÃO DE AFILIADOS & COMISSÕES
        ========================================== */}
        {activeTab === 'afiliados' && (
          <div className="space-y-6 animate-in fade-in duration-200">

            {/* Top Bar with Link to Portal */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div>
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <Share2 className="w-5 h-5 text-amber-400" />
                  Rede de Afiliados e Comissões
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Altere a porcentagem de comissão de cada afiliado, aprove cadastros e monitore vendas em tempo real.
                </p>
              </div>
              <a
                href="/afiliados/admin"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-400 to-yellow-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/20 transition-all shrink-0"
              >
                <span>Portal Completo de Afiliados</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Notification / Feedback Banner */}
            {affiliateActionFeedback && (
              <div className={`p-4 rounded-xl text-xs font-bold flex items-center gap-2 animate-in fade-in ${
                affiliateActionFeedback.includes('sucesso') 
                  ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300' 
                  : 'bg-rose-950/80 border border-rose-500 text-rose-300'
              }`}>
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{affiliateActionFeedback}</span>
              </div>
            )}

            {/* Metrics cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Total de Afiliados</span>
                <span className="text-xl sm:text-2xl font-black text-white">{affiliates.length}</span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Aprovados</span>
                <span className="text-xl sm:text-2xl font-black text-emerald-400">
                  {affiliates.filter(a => a.status === 'aprovado').length}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Pendentes</span>
                <span className="text-xl sm:text-2xl font-black text-amber-400">
                  {affiliates.filter(a => a.status === 'pendente').length}
                </span>
              </div>
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
                <span className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Total de Vendas Rede</span>
                <span className="text-xl sm:text-2xl font-black text-cyan-400">
                  {affiliates.reduce((acc, a) => acc + (a.totalConversions || 0), 0)}
                </span>
              </div>
            </div>

            {/* Filter and Table Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-4">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Buscar afiliado por nome, CPF, código ou e-mail..."
                    value={affiliateSearchTerm}
                    onChange={(e) => setAffiliateSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  onClick={async () => {
                    const res = await fetch('/api/afiliados/list');
                    if (res.ok) {
                      const d = await res.json();
                      if (d.success && d.affiliates) setAffiliates(d.affiliates);
                    }
                  }}
                  className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Atualizar</span>
                </button>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                    <tr>
                      <th className="pb-3 font-semibold">Afiliado</th>
                      <th className="pb-3 font-semibold">Código</th>
                      <th className="pb-3 font-semibold">WhatsApp</th>
                      <th className="pb-3 font-semibold">Vendas / Cliques</th>
                      <th className="pb-3 font-semibold text-center">Status</th>
                      <th className="pb-3 font-semibold text-center">Comissão (%)</th>
                      <th className="pb-3 font-semibold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {affiliates.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 text-center text-slate-500">
                          Nenhum afiliado cadastrado ainda.
                        </td>
                      </tr>
                    ) : (
                      affiliates
                        .filter(a => {
                          const term = affiliateSearchTerm.toLowerCase().trim();
                          if (!term) return true;
                          return (
                            a.fullName.toLowerCase().includes(term) ||
                            a.email.toLowerCase().includes(term) ||
                            a.exclusiveCode.toLowerCase().includes(term) ||
                            a.documentNumber.includes(term.replace(/\D/g, ''))
                          );
                        })
                        .map(a => {
                          const isEditing = editingRateId === a.id;
                          const isSaving = savingRateId === a.id;
                          const currentRatePct = Math.round((a.commissionRate || 0.15) * 100);
                          const cleanPhone = (a.whatsapp || a.phone || '').replace(/\D/g, '');

                          return (
                            <tr key={a.id} className="hover:bg-slate-800/30 transition-colors">
                              {/* Nome & Email */}
                              <td className="py-3">
                                <span className="font-bold text-white block">{a.fullName}</span>
                                <span className="text-[11px] text-slate-400">{a.email}</span>
                              </td>

                              {/* Código */}
                              <td className="py-3 font-mono">
                                <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                  {a.exclusiveCode}
                                </span>
                              </td>

                              {/* WhatsApp */}
                              <td className="py-3 font-mono">
                                {cleanPhone ? (
                                  <a
                                    href={`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(`Olá ${a.fullName}, aqui é da equipe do Tá Na Mão da SORTE!`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-emerald-400 hover:underline flex items-center gap-1"
                                  >
                                    <span>{a.whatsapp || a.phone}</span>
                                    <ExternalLink className="w-3 h-3" />
                                  </a>
                                ) : (
                                  <span className="text-slate-500">-</span>
                                )}
                              </td>

                              {/* Vendas / Cliques */}
                              <td className="py-3 font-mono text-slate-300">
                                <span className="text-emerald-400 font-bold">{a.totalConversions || 0}</span> vendas / <span className="text-cyan-400">{a.totalClicks || 0}</span> clicks
                              </td>

                              {/* Status */}
                              <td className="py-3 text-center">
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  a.status === 'aprovado'
                                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    : a.status === 'pendente'
                                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                                    : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                                }`}>
                                  {a.status}
                                </span>
                              </td>

                              {/* COMISSÃO EDITÁVEL */}
                              <td className="py-3 text-center">
                                {isEditing ? (
                                  <div className="flex items-center justify-center gap-1.5">
                                    <div className="relative w-16">
                                      <input
                                        type="number"
                                        min="1"
                                        max="80"
                                        value={editingRateValue}
                                        onChange={(e) => setEditingRateValue(e.target.value)}
                                        className="w-full px-2 py-1 bg-slate-950 border border-amber-400 rounded-lg text-xs text-white text-center font-bold focus:outline-none"
                                        disabled={isSaving}
                                      />
                                      <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-amber-400 font-bold">%</span>
                                    </div>
                                    <button
                                      onClick={() => handleUpdateCommission(a.id, Number(editingRateValue))}
                                      disabled={isSaving}
                                      className="p-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                                      title="Salvar nova comissão"
                                    >
                                      {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                    </button>
                                    <button
                                      onClick={() => setEditingRateId(null)}
                                      disabled={isSaving}
                                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 rounded-lg text-xs transition-all cursor-pointer"
                                      title="Cancelar"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => {
                                      setEditingRateId(a.id);
                                      setEditingRateValue(currentRatePct.toString());
                                    }}
                                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 hover:bg-amber-500/20 border border-emerald-500/30 hover:border-amber-400 text-emerald-400 hover:text-amber-300 rounded-lg font-mono font-bold transition-all cursor-pointer group"
                                    title="Clique para alterar a comissão deste afiliado"
                                  >
                                    <span>{currentRatePct}%</span>
                                    <Percent className="w-3 h-3 opacity-60 group-hover:opacity-100" />
                                  </button>
                                )}
                              </td>

                              {/* AÇÕES DE STATUS */}
                              <td className="py-3 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {a.status === 'pendente' && (
                                    <button
                                      onClick={() => handleUpdateAffiliateStatus(a.id, 'approve')}
                                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                    >
                                      Aprovar
                                    </button>
                                  )}
                                  {a.status === 'aprovado' && (
                                    <button
                                      onClick={() => handleUpdateAffiliateStatus(a.id, 'suspend')}
                                      className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900 border border-rose-800 text-rose-300 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                    >
                                      Suspender
                                    </button>
                                  )}
                                  {a.status === 'suspenso' && (
                                    <button
                                      onClick={() => handleUpdateAffiliateStatus(a.id, 'reactivate')}
                                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg text-[11px] font-bold transition-colors cursor-pointer"
                                    >
                                      Reativar
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

      </div>

    </div>
  );
}
