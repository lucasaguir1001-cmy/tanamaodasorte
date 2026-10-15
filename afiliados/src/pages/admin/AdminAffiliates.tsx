import React, { useState, useMemo, useEffect } from 'react';
import { MockDatabase } from '../../services/mockData';
import { AdminService } from '../../services/adminService';
import { Affiliate } from '../../types';
import { Card } from '../../components/common/Card';
import { Button } from '../../components/common/Button';
import { Input } from '../../components/common/Input';
import { Modal } from '../../components/common/Modal';
import { Badge } from '../../components/common/Badge';
import { formatBRL, formatDate, formatDateTime, maskDocumentSecret } from '../../utils/formatters';
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  ShieldAlert,
  Edit3,
  Percent,
  Eye,
  KeyRound,
  ExternalLink,
  MessageCircle
} from 'lucide-react';

export const AdminAffiliates: React.FC = () => {
  const [affiliates, setAffiliates] = useState<Affiliate[]>(MockDatabase.getAffiliates());
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Detail Modal / Drawer
  const [selectedAffiliate, setSelectedAffiliate] = useState<Affiliate | null>(null);

  // Rate Edit Modal
  const [rateAffiliate, setRateAffiliate] = useState<Affiliate | null>(null);
  const [newRatePct, setNewRatePct] = useState('15');
  const [savingRate, setSavingRate] = useState(false);
  const [rateFeedback, setRateFeedback] = useState<string | null>(null);

  // Reject / Suspend Modal
  const [actionAffiliate, setActionAffiliate] = useState<{ aff: Affiliate; type: 'reject' | 'suspend' } | null>(null);
  const [actionReason, setActionReason] = useState('');

  const reloadAffiliates = () => {
    fetch('/api/afiliados/list')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.affiliates && d.affiliates.length > 0) {
          setAffiliates(d.affiliates);
          MockDatabase.saveAffiliates(d.affiliates);
        } else {
          setAffiliates(MockDatabase.getAffiliates());
        }
      })
      .catch(() => setAffiliates(MockDatabase.getAffiliates()));
  };

  useEffect(() => {
    reloadAffiliates();
  }, []);

  const filtered = useMemo(() => {
    return affiliates.filter(a => {
      const matchSearch =
        a.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.exclusiveCode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.documentNumber.includes(searchTerm.replace(/\D/g, ''));
      const matchStatus = statusFilter === 'all' || a.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [affiliates, searchTerm, statusFilter]);

  const handleApprove = async (id: string) => {
    AdminService.approveAffiliate(id);
    try {
      await fetch('/api/afiliados/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: id, action: 'approve' })
      });
    } catch (e) {
      console.warn('Erro ao aprovar afiliado:', e);
    }

    reloadAffiliates();
    if (selectedAffiliate?.id === id) {
      setSelectedAffiliate(null);
    }
  };

  const handleConfirmAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actionAffiliate) return;

    try {
      if (actionAffiliate.type === 'reject') {
        AdminService.rejectAffiliate(actionAffiliate.aff.id, actionReason);
        await fetch('/api/afiliados/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateId: actionAffiliate.aff.id, action: 'reject', rejectionReason: actionReason })
        });
      } else {
        AdminService.suspendAffiliate(actionAffiliate.aff.id, actionReason);
        await fetch('/api/afiliados/action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ affiliateId: actionAffiliate.aff.id, action: 'suspend', rejectionReason: actionReason })
        });
      }
    } catch (err) {
      console.warn(err);
    }

    reloadAffiliates();
    setActionAffiliate(null);
    setActionReason('');
    setSelectedAffiliate(null);
  };

  const handleReactivate = async (id: string) => {
    AdminService.reactivateAffiliate(id);
    try {
      await fetch('/api/afiliados/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ affiliateId: id, action: 'reactivate' })
      });
    } catch (err) {
      console.warn(err);
    }
    reloadAffiliates();
    if (selectedAffiliate?.id === id) {
      setSelectedAffiliate(null);
    }
  };

  const handleSaveRate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rateAffiliate) return;
    const rateDecimal = parseFloat(newRatePct) / 100;
    if (isNaN(rateDecimal) || rateDecimal <= 0) return;

    setSavingRate(true);
    setRateFeedback(null);

    // 1. Atualiza no MockDatabase local
    AdminService.updateAffiliateCommissionRate(rateAffiliate.id, rateDecimal);

    // 2. Persiste no Supabase / Servidor
    try {
      const res = await fetch('/api/afiliados/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          affiliateId: rateAffiliate.id,
          action: 'update_rate',
          commissionRate: rateDecimal
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Erro ao salvar comissão no servidor');
      }
      setRateFeedback(`Comissão de ${rateAffiliate.fullName} atualizada para ${newRatePct}% com sucesso!`);
    } catch (err: any) {
      console.warn('Erro ao atualizar taxa de comissão no servidor:', err);
      setRateFeedback(`Erro ao salvar no banco: ${err.message || 'Tente novamente'}`);
    } finally {
      setSavingRate(false);
    }

    reloadAffiliates();
    if (selectedAffiliate?.id === rateAffiliate.id) {
      setSelectedAffiliate({ ...selectedAffiliate, commissionRate: rateDecimal });
    }
    setTimeout(() => {
      setRateAffiliate(null);
      setRateFeedback(null);
    }, 1200);
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-amber-400" />
            Gestão da Rede de Afiliados
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Moderação de cadastros, controle de status, canais e personalização de comissões.
          </p>
        </div>
      </div>

      {/* Filter Strip */}
      <Card className="p-4 sm:p-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Buscar por Nome, E-mail, CPF ou Código:
            </label>
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Ex: Lucas, 123.456, SORTE-8821..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1">
              Filtrar por Status:
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-amber-400"
            >
              <option value="all">Todos os Status ({affiliates.length})</option>
              <option value="pendente">Aguardando Aprovação</option>
              <option value="aprovado">Aprovados</option>
              <option value="suspenso">Suspensos</option>
              <option value="recusado">Recusados</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Affiliates List Table */}
      <Card className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
              <tr>
                <th className="pb-3 font-semibold">Afiliado</th>
                <th className="pb-3 font-semibold">Código</th>
                <th className="pb-3 font-semibold">Taxa</th>
                <th className="pb-3 font-semibold">Cliques / Vendas</th>
                <th className="pb-3 font-semibold">Saldo Disp.</th>
                <th className="pb-3 font-semibold text-center">Status</th>
                <th className="pb-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-sans">
              {filtered.map(aff => (
                <tr key={aff.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3">
                    <span className="font-bold text-white block">{aff.fullName}</span>
                    <span className="text-[11px] text-slate-400">{aff.email}</span>
                  </td>
                  <td className="py-3 font-mono font-bold text-amber-400">{aff.exclusiveCode}</td>
                  <td className="py-3 font-mono font-bold text-emerald-400">
                    {(aff.commissionRate * 100).toFixed(0)}%
                  </td>
                  <td className="py-3 font-mono text-slate-300">
                    <span className="text-cyan-400">{aff.totalClicks}</span> / <span className="text-emerald-400">{aff.totalConversions}</span>
                  </td>
                  <td className="py-3 font-mono font-bold text-white">{formatBRL(aff.balanceAvailable)}</td>
                  <td className="py-3 text-center">
                    <Badge status={aff.status} />
                  </td>
                  <td className="py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => setSelectedAffiliate(aff)}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors cursor-pointer"
                        title="Ver Detalhes do Afiliado"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {aff.status === 'pendente' && (
                        <button
                          onClick={() => handleApprove(aff.id)}
                          className="p-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 rounded-lg transition-colors cursor-pointer"
                          title="Aprovar Afiliado"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setRateAffiliate(aff);
                          setNewRatePct((aff.commissionRate * 100).toString());
                        }}
                        className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors cursor-pointer"
                        title="Ajustar Comissão"
                      >
                        <Percent className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* DETAIL MODAL / DRAWER */}
      <Modal
        isOpen={Boolean(selectedAffiliate)}
        onClose={() => setSelectedAffiliate(null)}
        title={selectedAffiliate ? `Detalhes: ${selectedAffiliate.fullName}` : ''}
        maxWidth="lg"
      >
        {selectedAffiliate && (
          <div className="space-y-6 text-left">
            <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
              <div>
                <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider block">Código Exclusivo</span>
                <span className="text-lg font-mono font-black text-amber-400">{selectedAffiliate.exclusiveCode}</span>
              </div>
              <Badge status={selectedAffiliate.status} />
            </div>

            {/* Cadastral Info */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Documento</span>
                <span className="text-white font-mono font-bold">{selectedAffiliate.documentNumber} ({selectedAffiliate.documentType})</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Localização</span>
                <span className="text-white">{selectedAffiliate.city} - {selectedAffiliate.state}</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Telefone / WhatsApp</span>
                <span className="text-white font-mono">{selectedAffiliate.phone}</span>
              </div>
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800">
                <span className="text-slate-400 block text-[10px] uppercase font-bold">Chave Pix</span>
                <span className="text-emerald-400 font-mono font-bold truncate block">{selectedAffiliate.pixKey} ({selectedAffiliate.pixKeyType})</span>
              </div>
            </div>

            {/* Strategy & Channels */}
            <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-2 text-xs">
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Canais Declarados:</span>
                <span className="text-white">{selectedAffiliate.socialChannels}</span>
              </div>
              <div>
                <span className="text-slate-400 font-bold block text-[10px] uppercase">Plano de Divulgação:</span>
                <span className="text-slate-300">{selectedAffiliate.promotionStrategy}</span>
              </div>
            </div>

            {/* Quick Actions in Modal */}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-800">
              <Button
                type="button"
                variant="amber"
                onClick={() => {
                  setRateAffiliate(selectedAffiliate);
                  setNewRatePct((selectedAffiliate.commissionRate * 100).toString());
                }}
                className="w-full flex items-center justify-center gap-2 mb-2"
              >
                <Percent className="w-4 h-4" />
                <span>Ajustar Taxa de Comissão (Atual: {(selectedAffiliate.commissionRate * 100).toFixed(0)}%)</span>
              </Button>

              {selectedAffiliate.status === 'pendente' && (
                <>
                  <Button
                    onClick={() => handleApprove(selectedAffiliate.id)}
                    className="flex-1"
                  >
                    Aprovar Afiliado 🍀
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => setActionAffiliate({ aff: selectedAffiliate, type: 'reject' })}
                    className="flex-1"
                  >
                    Recusar Cadastro
                  </Button>
                </>
              )}

              {selectedAffiliate.status === 'aprovado' && (
                <Button
                  variant="danger"
                  onClick={() => setActionAffiliate({ aff: selectedAffiliate, type: 'suspend' })}
                  className="w-full"
                >
                  Suspender Conta Preventivamente
                </Button>
              )}

              {selectedAffiliate.status === 'suspenso' && (
                <Button
                  onClick={() => handleReactivate(selectedAffiliate.id)}
                  className="w-full"
                >
                  Reativar Conta
                </Button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* RATE ADJUSTMENT MODAL */}
      <Modal
        isOpen={Boolean(rateAffiliate)}
        onClose={() => {
          if (!savingRate) {
            setRateAffiliate(null);
            setRateFeedback(null);
          }
        }}
        title="Personalizar Taxa de Comissão"
      >
        <form onSubmit={handleSaveRate} className="space-y-4 text-left">
          <p className="text-xs text-slate-300">
            Ajuste a comissão para o parceiro <strong>{rateAffiliate?.fullName}</strong>. A taxa padrão é de 15%.
          </p>

          <Input
            label="Nova Taxa de Comissão (%)"
            type="number"
            min="1"
            max="80"
            value={newRatePct}
            onChange={(e) => setNewRatePct(e.target.value)}
            helperText="Ex: 20 para 20%, 25 para parceiros VIP."
            disabled={savingRate}
            required
          />

          {rateFeedback && (
            <div className={`p-2.5 rounded-xl text-xs font-bold text-center ${rateFeedback.includes('sucesso') ? 'bg-emerald-950/80 border border-emerald-500 text-emerald-300' : 'bg-rose-950/80 border border-rose-500 text-rose-300'}`}>
              {rateFeedback}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setRateAffiliate(null);
                setRateFeedback(null);
              }}
              className="flex-1"
              disabled={savingRate}
            >
              Cancelar
            </Button>
            <Button type="submit" className="flex-1" disabled={savingRate}>
              {savingRate ? 'Salvando...' : 'Salvar Taxa'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* REJECT / SUSPEND MODAL */}
      <Modal
        isOpen={Boolean(actionAffiliate)}
        onClose={() => setActionAffiliate(null)}
        title={actionAffiliate?.type === 'reject' ? 'Recusar Cadastro' : 'Suspender Conta'}
      >
        <form onSubmit={handleConfirmAction} className="space-y-4 text-left">
          <p className="text-xs text-slate-300">
            Informe o motivo para {actionAffiliate?.type === 'reject' ? 'recusar a solicitação de' : 'suspender'} <strong>{actionAffiliate?.aff.fullName}</strong>:
          </p>

          <Input
            label="Justificativa Oficial"
            placeholder="Ex: Dados cadastrais divergentes na Receita Federal / Prática de spam"
            value={actionReason}
            onChange={(e) => setActionReason(e.target.value)}
            required
          />

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setActionAffiliate(null)}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              className="flex-1"
            >
              Confirmar
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
