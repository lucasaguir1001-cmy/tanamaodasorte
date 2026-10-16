import React, { useState, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { MockDatabase } from '../../services/mockData';
import { TrackingService } from '../../services/trackingService';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Badge } from '../../components/common/Badge';
import { formatBRL, formatDate, formatDateTime } from '../../utils/formatters';
import {
  Wallet,
  Clock,
  TrendingUp,
  MousePointerClick,
  CheckCircle,
  Percent,
  Copy,
  Check,
  Share2,
  Calendar,
  Sparkles,
  Zap,
  ArrowUpRight,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar
} from 'recharts';

export const DashboardHome: React.FC = () => {
  const { currentAffiliate, refreshAffiliate } = useAuth();
  const [periodFilter, setPeriodFilter] = useState<'7d' | '30d' | 'month' | 'today'>('7d');
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const affiliate = currentAffiliate || MockDatabase.getAffiliates()[0];
  const [commissions, setCommissions] = useState(() =>
    MockDatabase.getCommissions().filter(c => c.affiliateId === affiliate.id || (affiliate.exclusiveCode && c.affiliateCode === affiliate.exclusiveCode))
  );

  const fetchCommissionsData = React.useCallback(async () => {
    if (!affiliate?.exclusiveCode && !affiliate?.id) return;
    try {
      const res = await fetch(`/api/afiliados/commissions?affiliateCode=${affiliate.exclusiveCode}&affiliateId=${affiliate.id}`);
      const data = await res.json();
      if (data.success) {
        if (data.commissions) {
          setCommissions(data.commissions);
          const allComms = MockDatabase.getCommissions().filter(c =>
            c.affiliateId !== affiliate.id && c.affiliateCode !== affiliate.exclusiveCode
          );
          MockDatabase.saveCommissions([...data.commissions, ...allComms]);
        }
        if (data.affiliate) {
          const allAffs = MockDatabase.getAffiliates();
          const idx = allAffs.findIndex(a => a.id === data.affiliate.id || a.exclusiveCode === data.affiliate.exclusiveCode);
          if (idx !== -1) {
            allAffs[idx] = { ...allAffs[idx], ...data.affiliate };
          } else {
            allAffs.unshift(data.affiliate);
          }
          MockDatabase.saveAffiliates(allAffs);
          localStorage.setItem('tns_current_affiliate', JSON.stringify({ ...affiliate, ...data.affiliate }));
          refreshAffiliate();
        }
      }
    } catch (err) {
      console.warn('Erro ao carregar comissões:', err);
    }
  }, [affiliate?.id, affiliate?.exclusiveCode, refreshAffiliate]);

  useEffect(() => {
    fetchCommissionsData();
    const interval = setInterval(() => {
      fetchCommissionsData();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchCommissionsData]);

  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    await fetchCommissionsData();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const effectiveBalancePending = useMemo(() => {
    const fromComms = commissions
      .filter(c => c.status === 'pendente' || c.status === 'aprovada' || c.status === 'em_analise')
      .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
    return Math.max(affiliate.balancePending || 0, Number(fromComms.toFixed(2)));
  }, [commissions, affiliate.balancePending]);

  const effectiveBalanceAvailable = useMemo(() => {
    const fromComms = commissions
      .filter(c => c.status === 'disponivel')
      .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
    return Math.max(affiliate.balanceAvailable || 0, Number(fromComms.toFixed(2)));
  }, [commissions, affiliate.balanceAvailable]);

  const effectiveBalancePaid = useMemo(() => {
    const fromComms = commissions
      .filter(c => c.status === 'pago')
      .reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
    return Math.max(affiliate.balancePaid || 0, Number(fromComms.toFixed(2)));
  }, [commissions, affiliate.balancePaid]);

  const effectiveConversions = useMemo(() => {
    const fromComms = commissions.filter(c => c.status !== 'cancelada' && c.status !== 'cancelado').length;
    return Math.max(affiliate.totalConversions || 0, fromComms);
  }, [commissions, affiliate.totalConversions]);

  const payments = MockDatabase.getPayments().filter(p => p.affiliateId === affiliate.id);
  const links = MockDatabase.getLinks().filter(l => l.affiliateId === affiliate.id);

  const primaryLink = links[0]?.fullUrl || `https://tanamaodasorte.com.br/?afiliado=${affiliate.exclusiveCode}`;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(primaryLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(
      `🍀 Olá! Conheça o Tá Na Mão da SORTE: Bingo e Loteria Digital com sorteios diários às 19h e prêmio de R$ 500,00 via Pix! Bilhetes por apenas R$ 2,00.\n\nEscolha seus números da sorte aqui:\n${primaryLink}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Conversion rate
  const conversionRate = useMemo(() => {
    if (!affiliate.totalClicks || affiliate.totalClicks === 0) return '0.0%';
    const rate = (affiliate.totalConversions / affiliate.totalClicks) * 100;
    return `${rate.toFixed(1)}%`;
  }, [affiliate]);

  // Last payment
  const lastPayment = useMemo(() => {
    const paidList = payments.filter(p => p.status === 'pago');
    return paidList[0] || null;
  }, [payments]);

  // Generate realistic chart data based on filter
  const chartData = useMemo(() => {
    const days = periodFilter === '7d' ? 7 : periodFilter === 'today' ? 1 : 30;
    const data = [];
    const now = new Date();

    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const label = days === 1 ? 'Hoje' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

      // Simulated realistic daily metrics
      const baseClicks = Math.floor(25 + Math.sin(i * 0.8) * 15 + Math.random() * 20);
      const baseConversions = Math.max(1, Math.floor(baseClicks * 0.12));
      const baseCommission = Number((baseConversions * 2.0 * affiliate.commissionRate).toFixed(2));

      data.push({
        date: label,
        cliques: baseClicks,
        conversoes: baseConversions,
        comissao: baseCommission
      });
    }
    return data;
  }, [periodFilter, affiliate.commissionRate]);

  return (
    <div className="space-y-6">
      
      {/* Top Welcome Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 p-4 sm:p-6 rounded-3xl border border-slate-800">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-black text-white">
              Olá, {affiliate.fullName.split(' ')[0]}!
            </h1>
            <Badge status={affiliate.status} />
          </div>
          <p className="text-xs text-slate-400">
            Acompanhe o desempenho das suas divulgações e seus ganhos em tempo real.
          </p>
        </div>

        {/* Quick Link Capsule */}
        <div className="flex items-center gap-2 bg-slate-950 p-2 pl-3 rounded-2xl border border-emerald-900/60 max-w-md w-full sm:w-auto">
          <div className="text-left overflow-hidden">
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider block">
              Seu Link Principal
            </span>
            <span className="text-xs font-mono text-slate-300 truncate block max-w-[200px] sm:max-w-[260px]">
              {primaryLink}
            </span>
          </div>

          <div className="flex items-center gap-1 shrink-0 ml-auto">
            <button
              onClick={handleCopyLink}
              className="p-2 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-xl transition-colors cursor-pointer"
              title="Copiar Link"
            >
              {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            </button>
            <button
              onClick={handleShareWhatsApp}
              className="p-2 bg-green-600/20 hover:bg-green-600/30 text-green-400 rounded-xl transition-colors cursor-pointer"
              title="Compartilhar no WhatsApp"
            >
              <Share2 className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Card 1: Saldo Disponível */}
        <Card variant="glow-emerald" className="relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">
              Saldo Disponível
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <Wallet className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mb-2">
            {formatBRL(effectiveBalanceAvailable)}
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-emerald-950">
            <span className="text-[11px] text-slate-400">Pronto para saque</span>
            <Link to="/afiliados/comissoes">
              <span className="text-xs text-emerald-400 font-bold hover:underline flex items-center gap-0.5">
                Sacar Pix <ArrowUpRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          </div>
        </Card>

        {/* Card 2: Saldo Pendente */}
        <Card variant="glow-amber">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-amber-400 font-bold uppercase tracking-wider">
              Saldo em Análise
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-amber-300 mb-2">
            {formatBRL(effectiveBalancePending)}
          </div>
          <div className="pt-2 border-t border-amber-950/80 text-[11px] text-slate-400">
            Liberação pós-sorteio diário
          </div>
        </Card>

        {/* Card 3: Total Acumulado */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              Total Faturado
            </span>
            <div className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-white mb-2">
            {formatBRL(effectiveBalancePaid + effectiveBalanceAvailable + effectiveBalancePending)}
          </div>
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400">
            Já pago no Pix: <strong className="text-green-400 font-mono">{formatBRL(effectiveBalancePaid)}</strong>
          </div>
        </Card>

        {/* Card 4: Cliques & Conversão */}
        <Card>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider">
              Taxa de Conversão
            </span>
            <div className="w-8 h-8 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center">
              <Percent className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-black font-mono text-cyan-300 mb-2">
            {conversionRate}
          </div>
          <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 flex justify-between">
            <span>Cliques: <strong className="text-white font-mono">{affiliate.totalClicks}</strong></span>
            <span>Vendas: <strong className="text-emerald-400 font-mono">{effectiveConversions}</strong></span>
          </div>
        </Card>
      </div>

      {/* PERFORMANCE CHARTS SECTION */}
      <Card className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h3 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-emerald-400" /> Desempenho de Divulgação
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Comparativo de cliques atraídos versus comissões geradas no período.
            </p>
          </div>

          {/* Period Filter Buttons */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 self-start sm:self-auto">
            <button
              onClick={() => setPeriodFilter('today')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodFilter === 'today' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hoje
            </button>
            <button
              onClick={() => setPeriodFilter('7d')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodFilter === '7d' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              7 dias
            </button>
            <button
              onClick={() => setPeriodFilter('30d')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                periodFilter === '30d' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              30 dias
            </button>
          </div>
        </div>

        {/* Chart */}
        <div className="h-64 sm:h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorCliques" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="colorComissao" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="date" stroke="#64748b" fontSize={11} tickLine={false} />
              <YAxis stroke="#64748b" fontSize={11} tickLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#0f172a',
                  borderColor: '#334155',
                  borderRadius: '12px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              />
              <Area
                type="monotone"
                dataKey="cliques"
                name="Cliques no Link"
                stroke="#06b6d4"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorCliques)"
              />
              <Area
                type="monotone"
                dataKey="comissao"
                name="Comissão (R$)"
                stroke="#10b981"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#colorComissao)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* RECENT COMMISSIONS TABLE */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-bold text-white flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            Comissões Recentes
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleManualRefresh}
              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all text-xs flex items-center gap-1.5 cursor-pointer border border-slate-700"
              title="Atualizar Vendas"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-emerald-400 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-[11px] font-semibold text-slate-300">Atualizar</span>
            </button>
            <Link
              to="/afiliados/comissoes"
              className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1"
            >
              Ver Extrato Completo <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {commissions.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-400">
            Nenhuma comissão registrada ainda. Comece a divulgar seu link exclusivo para receber comissões!
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                <tr>
                  <th className="pb-3 font-semibold">Data / Hora</th>
                  <th className="pb-3 font-semibold">Cliente</th>
                  <th className="pb-3 font-semibold">Campanha</th>
                  <th className="pb-3 font-semibold">Valor da Compra</th>
                  <th className="pb-3 font-semibold">Sua Comissão</th>
                  <th className="pb-3 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {commissions.slice(0, 8).map(c => {
                  const firstName = (c.buyerFirstName || c.buyerName || '').trim().split(' ')[0] || 'Cliente';
                  return (
                    <tr key={c.id} className="hover:bg-slate-800/30 transition-colors">
                      <td className="py-3 text-slate-300">{formatDateTime(c.createdAt)}</td>
                      <td className="py-3 font-bold text-white">
                        <div className="flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 text-[10px] font-black flex items-center justify-center border border-emerald-500/30">
                            {firstName.charAt(0).toUpperCase()}
                          </span>
                          <span>{firstName}</span>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-400 font-mono text-[11px]">
                          {c.campaign || 'padrao'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300 font-mono">{formatBRL(c.orderAmount)}</td>
                      <td className="py-3 font-mono font-black text-emerald-400">
                        +{formatBRL(c.commissionAmount)}
                      </td>
                      <td className="py-3 text-right">
                        <Badge status={c.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
};
