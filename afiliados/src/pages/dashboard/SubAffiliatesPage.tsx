import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { MockDatabase } from '../../services/mockData';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { formatBRL, formatDate } from '../../utils/formatters';
import { maskCPF, maskPhone } from '../../utils/formatters';
import { validateCPF, validateEmail, validatePhone } from '../../utils/validators';
import { Affiliate, Commission } from '../../types';
import {
  Users,
  UserPlus,
  Share2,
  Copy,
  Check,
  Percent,
  TrendingUp,
  DollarSign,
  MessageCircle,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  Search,
  RefreshCw,
  Award
} from 'lucide-react';

export const SubAffiliatesPage: React.FC = () => {
  const { currentAffiliate } = useAuth();
  const affiliate = currentAffiliate || MockDatabase.getAffiliates()[0];

  const parentMaxPercent = Math.max(15, Math.round((affiliate?.commissionRate || 0.15) * 100));

  // Commission % granted to new sub-affiliate (default 10%)
  const [selectedRate, setSelectedRate] = useState<number>(10);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedSubCode, setCopiedSubCode] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Sub-affiliates list & override commissions
  const [subAffiliates, setSubAffiliates] = useState<Affiliate[]>([]);
  const [overrideCommissions, setOverrideCommissions] = useState<Commission[]>([]);

  // Direct Registration Modal State
  const [showModal, setShowModal] = useState(false);
  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formWhatsapp, setFormWhatsapp] = useState('');
  const [formCpf, setFormCpf] = useState('');
  const [formPassword, setFormPassword] = useState('sorte1234');
  const [formRate, setFormRate] = useState<number>(10);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invitation link builder
  const inviteUrl = useMemo(() => {
    const origin = typeof window !== 'undefined' ? window.location.origin : 'https://tanamaodasorte.com.br';
    const code = affiliate?.exclusiveCode || 'MEU-CODIGO';
    return `${origin}/afiliados/cadastro?sponsor=${encodeURIComponent(code)}&rate=${selectedRate}`;
  }, [affiliate?.exclusiveCode, selectedRate]);

  // Load sub-affiliates and override commissions
  const loadNetworkData = React.useCallback(async () => {
    if (!affiliate?.exclusiveCode && !affiliate?.id) return;
    const code = affiliate.exclusiveCode;
    const id = affiliate.id;

    try {
      // 1. Fetch from server API
      const res = await fetch(`/api/afiliados/list?parent=${encodeURIComponent(code)}&parentId=${encodeURIComponent(id)}`);
      const data = await res.json();

      let fetchedSubs: Affiliate[] = [];
      if (data.success && Array.isArray(data.affiliates)) {
        fetchedSubs = data.affiliates;
      }

      // Merge with local storage cache
      const localSubs = MockDatabase.getAffiliates().filter(
        a => (a.parentAffiliateCode && a.parentAffiliateCode.toUpperCase() === code.toUpperCase()) ||
             (a.parentAffiliateId && a.parentAffiliateId === id) ||
             (a.promotionStrategy && a.promotionStrategy.toUpperCase().includes(code.toUpperCase()))
      );

      const mergedMap = new Map<string, Affiliate>();
      fetchedSubs.forEach(a => mergedMap.set(a.id || a.exclusiveCode, a));
      localSubs.forEach(a => {
        if (!mergedMap.has(a.id || a.exclusiveCode)) {
          mergedMap.set(a.id || a.exclusiveCode, a);
        }
      });

      setSubAffiliates(Array.from(mergedMap.values()));

      // 2. Load override commissions
      const commRes = await fetch(`/api/afiliados/commissions?affiliateCode=${encodeURIComponent(code)}&affiliateId=${encodeURIComponent(id)}`);
      const commData = await commRes.json();
      if (commData.success && Array.isArray(commData.commissions)) {
        const overrides = commData.commissions.filter((c: Commission) => c.isOverride === true || (c.campaign && c.campaign.startsWith('rede_')));
        setOverrideCommissions(overrides);
      } else {
        const localOverrides = MockDatabase.getCommissions().filter(
          c => (c.affiliateId === id || c.affiliateCode === code) && (c.isOverride === true || (c.campaign && c.campaign.startsWith('rede_')))
        );
        setOverrideCommissions(localOverrides);
      }
    } catch (err) {
      console.warn('Erro ao carregar dados da rede de afiliados:', err);
      // Fallback
      const localSubs = MockDatabase.getAffiliates().filter(
        a => (a.parentAffiliateCode && a.parentAffiliateCode.toUpperCase() === code.toUpperCase()) ||
             (a.parentAffiliateId && a.parentAffiliateId === id) ||
             (a.promotionStrategy && a.promotionStrategy.toUpperCase().includes(code.toUpperCase()))
      );
      setSubAffiliates(localSubs);
    }
  }, [affiliate?.exclusiveCode, affiliate?.id]);

  useEffect(() => {
    loadNetworkData();
    const interval = setInterval(loadNetworkData, 10000);
    return () => clearInterval(interval);
  }, [loadNetworkData]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadNetworkData();
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopySubCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedSubCode(code);
    setTimeout(() => setCopiedSubCode(null), 2000);
  };

  const handleShareWhatsapp = () => {
    const text = encodeURIComponent(
      `🍀 Convite Oficial para Afiliado Parceiro do Tá Na Mão da SORTE!\n\n` +
      `Estou te convidando para ser afiliado(a) parceiro(a) com comissão garantida de ${selectedRate}% por cada bilhete vendido!\n\n` +
      `Cadastre-se pelo meu link oficial e comece hoje mesmo:\n${inviteUrl}`
    );
    window.open(`https://api.whatsapp.com/send?text=${text}`, '_blank');
  };

  // Direct Registration handler
  const handleDirectRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanCpf = formCpf.replace(/\D/g, '');
    const cleanPhone = formWhatsapp.replace(/\D/g, '');

    if (!formName.trim() || formName.trim().split(' ').length < 2) {
      setFormError('Informe o nome e sobrenome completo do afiliado.');
      return;
    }
    if (!validateEmail(formEmail)) {
      setFormError('Informe um e-mail válido.');
      return;
    }
    if (!validatePhone(formWhatsapp)) {
      setFormError('Informe um WhatsApp válido com DDD.');
      return;
    }
    if (!validateCPF(formCpf)) {
      setFormError('CPF inválido. Verifique os dígitos digitados.');
      return;
    }
    if (formPassword.length < 6) {
      setFormError('A senha inicial deve ter no mínimo 6 caracteres.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        fullName: formName.trim(),
        email: formEmail.trim().toLowerCase(),
        password: formPassword,
        documentType: 'CPF',
        documentNumber: cleanCpf,
        phone: cleanPhone,
        whatsapp: cleanPhone,
        city: 'Brasil',
        state: 'SP',
        socialChannels: 'Rede de Afiliados Parceiros',
        promotionStrategy: `Indicado pelo Afiliado ${affiliate.exclusiveCode}`,
        parentAffiliateCode: affiliate.exclusiveCode,
        parentAffiliateId: affiliate.id,
        commissionRate: formRate / 100,
        termsAcceptedAt: new Date().toISOString(),
        privacyAcceptedAt: new Date().toISOString()
      };

      const res = await fetch('/api/afiliados/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (data.success && data.affiliate) {
        setFormSuccess(`Afiliado ${data.affiliate.fullName} cadastrado com sucesso! Código: ${data.affiliate.exclusiveCode}`);
        const allAffs = MockDatabase.getAffiliates();
        allAffs.unshift(data.affiliate);
        MockDatabase.saveAffiliates(allAffs);
        setSubAffiliates(prev => {
          const map = new Map<string, Affiliate>();
          map.set(data.affiliate.id || data.affiliate.exclusiveCode, data.affiliate);
          prev.forEach(p => map.set(p.id || p.exclusiveCode, p));
          return Array.from(map.values());
        });
        // Reset form
        setFormName('');
        setFormEmail('');
        setFormWhatsapp('');
        setFormCpf('');
        setFormPassword('sorte1234');
        // Refresh network
        await loadNetworkData();
        setTimeout(() => {
          setShowModal(false);
          setFormSuccess(null);
        }, 2500);
      } else {
        setFormError(data.error || 'Erro ao cadastrar afiliado no sistema.');
      }
    } catch {
      setFormError('Erro ao comunicar com o servidor. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculations
  const totalSubAffiliates = subAffiliates.length;
  const totalSubSales = subAffiliates.reduce((sum, s) => sum + (s.totalConversions || 0), 0);
  const totalResidualAmount = overrideCommissions.reduce((sum, c) => sum + (c.commissionAmount || 0), 0);
  const myResidualPercent = Math.max(1, parentMaxPercent - selectedRate);

  // Filtered sub-affiliates
  const filteredSubs = subAffiliates.filter(s => {
    const q = searchQuery.toLowerCase();
    return (
      s.fullName.toLowerCase().includes(q) ||
      s.exclusiveCode.toLowerCase().includes(q) ||
      s.email.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6">
      {/* Header & Page Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-700 flex items-center justify-center text-white shadow-md shadow-emerald-500/20">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
                Minha Rede de Afiliados
                <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  Multinível
                </span>
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                Afilie outras pessoas, decida a % de comissão delas e lucre com o spread de cada bilhete vendido por toda a sua rede!
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handleRefresh}
            className="flex items-center gap-1.5"
            disabled={isRefreshing}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Atualizar</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              setFormRate(selectedRate);
              setShowModal(true);
            }}
            className="flex items-center gap-1.5 shadow-lg shadow-emerald-500/20"
          >
            <UserPlus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>Cadastrar Afiliado</span>
          </Button>
        </div>
      </div>

      {/* KPI Cards Overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Afiliados na Rede</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-white">{totalSubAffiliates}</div>
          <p className="text-[11px] text-slate-400 mt-1">Parceiros recrutados sob você</p>
        </Card>

        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Vendas da Rede</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-emerald-400">{totalSubSales}</div>
          <p className="text-[11px] text-slate-400 mt-1">Bilhetes vendidos pelos afiliados</p>
        </Card>

        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Comissão Residual (Você)</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300">{formatBRL(totalResidualAmount)}</div>
          <p className="text-[11px] text-slate-400 mt-1">Seu ganho de spread da rede</p>
        </Card>

        <Card className="p-4 bg-slate-900/80 border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-bold">Sua Comissão Máxima</span>
            <div className="w-8 h-8 rounded-lg bg-purple-500/20 text-purple-400 flex items-center justify-center">
              <Award className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-black text-purple-300">{parentMaxPercent}%</div>
          <p className="text-[11px] text-slate-400 mt-1">Margem para divisão com sua rede</p>
        </Card>
      </div>

      {/* Recrutamento e Link com Decisor de Porcentagem (%) */}
      <Card className="p-5 sm:p-6 bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/40 border-emerald-500/40 shadow-xl">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-5 h-5 text-amber-400" />
          <h2 className="text-base sm:text-lg font-black text-white">
            Link de Recrutamento com Porcentagem (%) Decidida por Você
          </h2>
        </div>

        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Escolha a porcentagem de comissão que deseja conceder aos novos afiliados da sua equipe. Quando eles se cadastrarem pelo seu link exclusivo, o sistema fixará automaticamente essa comissão para eles, e você receberá a diferença de cada bilhete que eles venderem!
        </p>

        {/* Seletor de Porcentagem (%) */}
        <div className="bg-slate-950/70 p-4 rounded-2xl border border-slate-800 space-y-4 mb-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <label className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Percent className="w-4 h-4 text-emerald-400" />
                <span>Porcentagem a dar para o seu afiliado:</span>
              </label>
              <p className="text-[11px] text-slate-400">
                Você pode conceder de 1% até {parentMaxPercent}% de comissão.
              </p>
            </div>

            {/* Presets rápidos */}
            <div className="flex items-center gap-1.5">
              {[5, 8, 10, 12, parentMaxPercent].filter(v => v <= parentMaxPercent).map(rate => (
                <button
                  key={rate}
                  type="button"
                  onClick={() => setSelectedRate(rate)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                    selectedRate === rate
                      ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/30'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  {rate}%
                </button>
              ))}
            </div>
          </div>

          {/* Slider interativo */}
          <div className="space-y-2">
            <input
              type="range"
              min={1}
              max={parentMaxPercent}
              value={selectedRate}
              onChange={(e) => setSelectedRate(Number(e.target.value))}
              className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg"
            />
            <div className="flex justify-between text-[11px] text-slate-500 font-mono">
              <span>1% (Mínimo)</span>
              <span className="text-emerald-400 font-bold">{selectedRate}% Selecionado</span>
              <span>{parentMaxPercent}% (Máximo de sua conta)</span>
            </div>
          </div>

          {/* Resumo da Divisão de Lucro (Simulação por Bilhete de R$ 2,00) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-800/80">
            <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-emerald-400 block tracking-wider">
                Comissão do Seu Afiliado
              </span>
              <div className="text-lg font-black text-white mt-0.5">
                {selectedRate}% <span className="text-xs text-emerald-300 font-medium">({formatBRL((selectedRate * 2.0) / 100)} por bilhete)</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Ele receberá esse valor a cada bilhete de R$ 2,00 vendido.
              </p>
            </div>

            <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-3">
              <span className="text-[10px] uppercase font-bold text-amber-400 block tracking-wider">
                Sua Margem Residual (Spread)
              </span>
              <div className="text-lg font-black text-amber-300 mt-0.5">
                {myResidualPercent}% <span className="text-xs text-amber-400/80 font-medium">({formatBRL((myResidualPercent * 2.0) / 100)} por bilhete)</span>
              </div>
              <p className="text-[10px] text-slate-400 mt-1">
                Você receberá esse lucro automático em todas as vendas dele!
              </p>
            </div>
          </div>
        </div>

        {/* Link Gerado & Ações de Compartilhamento */}
        <div className="space-y-3">
          <label className="text-xs font-bold text-slate-300">
            Link Exclusivo de Cadastro com {selectedRate}% de Comissão Garantida:
          </label>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              readOnly
              value={inviteUrl}
              className="flex-1 px-3 py-2.5 bg-slate-950 rounded-xl border border-slate-800 text-xs font-mono text-emerald-300 select-all focus:outline-none focus:border-emerald-500"
            />
            <div className="flex items-center gap-2">
              <Button
                variant="primary"
                onClick={handleCopyLink}
                className="flex items-center gap-1.5 whitespace-nowrap text-xs"
              >
                {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span>{copiedLink ? 'Copiado!' : 'Copiar Link'}</span>
              </Button>

              <Button
                variant="secondary"
                onClick={handleShareWhatsapp}
                className="flex items-center gap-1.5 whitespace-nowrap text-xs bg-green-950/40 text-green-400 border-green-600/40 hover:bg-green-900/50"
              >
                <MessageCircle className="w-4 h-4 text-green-400" />
                <span>WhatsApp</span>
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Tabela de Afiliados Recrutados */}
      <Card className="p-5 sm:p-6 bg-slate-900/80 border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <span>Afiliados Cadastrados sob sua Gestão</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-300">
                {filteredSubs.length}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Lista de todos os afiliados parceiros vinculados à sua conta.
            </p>
          </div>

          {/* Campo de Busca */}
          <div className="relative max-w-xs w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nome ou código..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>

        {filteredSubs.length === 0 ? (
          <div className="text-center py-12 px-4 border-2 border-dashed border-slate-800 rounded-2xl">
            <Users className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">Nenhum afiliado encontrado</h4>
            <p className="text-xs text-slate-400 max-w-md mx-auto mb-4">
              Você ainda não possui afiliados cadastrados na sua rede ou nenhum corresponde à sua busca. Compartilhe seu link de recrutamento ou cadastre um parceiro agora!
            </p>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setFormRate(selectedRate);
                setShowModal(true);
              }}
              className="inline-flex items-center gap-1.5"
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Primeiro Afiliado</span>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 uppercase text-[10px] tracking-wider">
                  <th className="py-3 px-3">Afiliado</th>
                  <th className="py-3 px-3">Código</th>
                  <th className="py-3 px-3">WhatsApp</th>
                  <th className="py-3 px-3">% Dele</th>
                  <th className="py-3 px-3">Seu Spread</th>
                  <th className="py-3 px-3 text-center">Vendas</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {filteredSubs.map((sub) => {
                  const subRatePercent = Math.round((sub.commissionRate || 0.10) * 100);
                  const parentSpread = Math.max(1, parentMaxPercent - subRatePercent);
                  const cleanPhone = (sub.whatsapp || sub.phone || '').replace(/\D/g, '');

                  return (
                    <tr key={sub.id || sub.exclusiveCode} className="hover:bg-slate-800/40 transition-colors">
                      {/* Nome e E-mail */}
                      <td className="py-3 px-3">
                        <div className="font-bold text-white">{sub.fullName}</div>
                        <div className="text-[11px] text-slate-400">{sub.email}</div>
                      </td>

                      {/* Código Exclusivo */}
                      <td className="py-3 px-3 font-mono">
                        <span className="font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                          {sub.exclusiveCode}
                        </span>
                      </td>

                      {/* WhatsApp com link direto */}
                      <td className="py-3 px-3">
                        {cleanPhone ? (
                          <a
                            href={`https://api.whatsapp.com/send?phone=55${cleanPhone}&text=${encodeURIComponent(`Olá ${sub.fullName}, aqui é seu patrocinador do Tá Na Mão da SORTE!`)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-emerald-400 hover:text-emerald-300 font-medium"
                            title="Conversar no WhatsApp"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{sub.whatsapp || sub.phone}</span>
                          </a>
                        ) : (
                          <span className="text-slate-500">-</span>
                        )}
                      </td>

                      {/* % Dele */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-emerald-400">{subRatePercent}%</span>
                        <div className="text-[10px] text-slate-500">R$ {((subRatePercent * 2) / 100).toFixed(2)}/bilhete</div>
                      </td>

                      {/* Seu Spread */}
                      <td className="py-3 px-3">
                        <span className="font-bold text-amber-300">{parentSpread}%</span>
                        <div className="text-[10px] text-slate-500">R$ {((parentSpread * 2) / 100).toFixed(2)}/bilhete</div>
                      </td>

                      {/* Total de Vendas */}
                      <td className="py-3 px-3 text-center">
                        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-white font-bold font-mono">
                          {sub.totalConversions || 0}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3">
                        <Badge status={sub.status} />
                      </td>

                      {/* Ações */}
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleCopySubCode(`https://tanamaodasorte.com.br/?afiliado=${sub.exclusiveCode}`)}
                          className="px-2.5 py-1 text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer inline-flex items-center gap-1"
                          title="Copiar link de vendas deste afiliado"
                        >
                          {copiedSubCode === `https://tanamaodasorte.com.br/?afiliado=${sub.exclusiveCode}` ? (
                            <>
                              <Check className="w-3 h-3 text-emerald-400" />
                              <span className="text-emerald-400">Copiado</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3" />
                              <span>Link Dele</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Modal de Cadastro Direto de Afiliado */}
      <Modal
        isOpen={showModal}
        onClose={() => {
          if (!isSubmitting) setShowModal(false);
        }}
        title="Cadastrar Novo Afiliado na sua Rede"
        maxWidth="lg"
      >
        <form onSubmit={handleDirectRegister} className="space-y-4">
          <p className="text-xs text-slate-400">
            Cadastre os dados do seu parceiro diretamente. Ele receberá o código exclusivo e poderá acessar o painel imediatamente para começar a divulgar!
          </p>

          {formError && (
            <div className="p-3 bg-red-950/60 border border-red-500/50 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{formError}</span>
            </div>
          )}

          {formSuccess && (
            <div className="p-3 bg-emerald-950/60 border border-emerald-500/50 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-400" />
              <span>{formSuccess}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Nome Completo *</label>
              <input
                type="text"
                placeholder="Ex: Pedro Henrique Silva"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">E-mail de Login *</label>
              <input
                type="email"
                placeholder="afiliado@exemplo.com"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">WhatsApp com DDD *</label>
              <input
                type="tel"
                placeholder="(11) 98765-4321"
                value={formWhatsapp}
                onChange={(e) => setFormWhatsapp(maskPhone(e.target.value))}
                required
                className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">CPF *</label>
              <input
                type="text"
                placeholder="000.000.000-00"
                value={formCpf}
                onChange={(e) => setFormCpf(maskCPF(e.target.value))}
                required
                className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">Senha Inicial de Acesso *</label>
              <input
                type="text"
                value={formPassword}
                onChange={(e) => setFormPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-950 rounded-xl border border-slate-800 text-xs text-white font-mono placeholder-slate-500 focus:outline-none focus:border-emerald-500"
              />
              <span className="text-[10px] text-slate-500 mt-0.5 block">Ele poderá alterar após entrar</span>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1">
                % de Comissão Dele: <strong className="text-emerald-400">{formRate}%</strong> (Seu spread: {Math.max(1, parentMaxPercent - formRate)}%)
              </label>
              <input
                type="range"
                min={1}
                max={parentMaxPercent}
                value={formRate}
                onChange={(e) => setFormRate(Number(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer h-2 bg-slate-800 rounded-lg mt-2"
              />
              <div className="flex justify-between text-[10px] text-slate-500">
                <span>1%</span>
                <span className="text-emerald-400 font-bold">{formRate}%</span>
                <span>{parentMaxPercent}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setShowModal(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>

            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isSubmitting}
              className="flex items-center gap-1.5"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Salvando...</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>Concluir Cadastro</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
