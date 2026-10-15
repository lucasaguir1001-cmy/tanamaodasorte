export type TipoMensagem = 'lembrete' | 'resultado' | 'parabenizacao';

export interface Usuario {
  id: string;
  nome_completo: string;
  cpf: string;
  whatsapp: string;
  data_cadastro: string;
}

export interface Bilhete {
  id: string;
  numero_milhar: string; // "0000" to "9999"
  usuario_id: string;
  sorteio_id: string;
  data_compra: string;
  status_pagamento: boolean;
  payment_id?: string;
  valor: number;
  usuario?: Usuario;
}

export interface Sorteio {
  id: string;
  data_sorteio: string; // ISO string
  numeros_sorteados: string | null; // e.g. "1234"
  ganhador_id: string | null;
  premio: number; // default R$ 500
  acumulado: boolean;
  status: 'agendado' | 'em_andamento' | 'finalizado';
  eh_domingo?: boolean;
  ganhador?: Usuario | null;
}

export interface Mensagem {
  id: string;
  usuario_id: string;
  conteudo: string;
  tipo: TipoMensagem;
  data_envio: string;
  status_envio?: string;
  destinatario_nome?: string;
  destinatario_whatsapp?: string;
}

export interface PixPaymentData {
  paymentId: string;
  qrCode: string;
  qrCodeBase64: string;
  copyPaste: string;
  amount: number;
  tickets: string[];
  expiresAt: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface AppConfig {
  ticketPrice: number;
  defaultPrize: number;
  drawHour: number; // 19
  testMode: boolean; // Modo de teste ativo antes de subir para produção
  mpAccessToken?: string;
  mpPublicKey?: string;
  whatsappApiUrl?: string;
  whatsappApiToken?: string;
}

export type AffiliateStatus = 'pendente' | 'aprovado' | 'recusado' | 'suspenso';
export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export interface Affiliate {
  id: string;
  fullName: string;
  email: string;
  password?: string;
  documentType: 'CPF' | 'CNPJ';
  documentNumber: string;
  phone: string;
  whatsapp: string;
  birthDate?: string;
  city: string;
  state: string;
  exclusiveCode: string;
  status: AffiliateStatus;
  rejectionReason?: string;
  commissionRate: number;
  pixKeyType: PixKeyType;
  pixKey: string;
  socialChannels: string;
  promotionStrategy: string;
  balanceAvailable: number;
  balancePending: number;
  balancePaid: number;
  totalClicks: number;
  totalConversions: number;
  termsAcceptedAt: string;
  privacyAcceptedAt: string;
  consentIp?: string;
  createdAt: string;
  approvedAt?: string;
  approvedBy?: string;
  parentAffiliateId?: string;
  parentAffiliateCode?: string;
  parentAffiliateName?: string;
}

export interface AffiliateLink {
  id: string;
  affiliateId: string;
  affiliateCode: string;
  destinationPath: string;
  campaignName: string;
  fullUrl: string;
  clicksCount: number;
  conversionsCount: number;
  revenueGenerated: number;
  isActive: boolean;
  createdAt: string;
}

export type CommissionStatus = 'pendente' | 'em_analise' | 'aprovada' | 'disponivel' | 'paga' | 'pago' | 'cancelada' | 'cancelado';

export interface Commission {
  id: string;
  conversionId: string;
  affiliateId: string;
  affiliateCode?: string;
  affiliateName?: string;
  orderAmount: number;
  commissionRate: number;
  commissionAmount: number;
  campaign?: string;
  status: CommissionStatus;
  cancellationReason?: string;
  availableAt?: string;
  paidAt?: string;
  buyerName?: string;
  buyerFirstName?: string;
  buyerCpf?: string;
  ticketsCount?: number;
  tickets?: string[];
  isOverride?: boolean;
  subAffiliateCode?: string;
  subAffiliateName?: string;
  createdAt: string;
}

export interface TicketReservation {
  id: string; // paymentId
  paymentId: string;
  tickets: string[];
  amount: number;
  userName: string;
  userCpf: string;
  userWhatsapp: string;
  userEmail?: string;
  affiliateCode?: string;
  campaign?: string;
  status: 'pending' | 'approved' | 'expired' | 'cancelled';
  createdAt: string;
  expiresAt: string;
}

export interface SorteadoProgramado {
  id?: string;
  nome_completo: string;
  cpf: string;
  whatsapp: string;
  numero_milhar: string;
  ativo: boolean;
  criado_em: string;
  utilizado_em?: string | null;
}

