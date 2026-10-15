export type UserRole = 'affiliate' | 'admin';

export type AffiliateStatus = 'pendente' | 'aprovado' | 'recusado' | 'suspenso';

export type PixKeyType = 'CPF' | 'CNPJ' | 'EMAIL' | 'PHONE' | 'RANDOM';

export type CommissionStatus = 'pendente' | 'em_analise' | 'aprovada' | 'disponivel' | 'paga' | 'pago' | 'cancelada' | 'cancelado';

export type PaymentStatus = 'solicitado' | 'em_processamento' | 'pago' | 'recusado';

export interface UserProfile {
  uid: string;
  email: string;
  role: UserRole;
  createdAt: string;
}

export interface Affiliate {
  id: string; // matches Firebase Auth UID
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
  exclusiveCode: string; // e.g. "LUCK-7890"
  status: AffiliateStatus;
  rejectionReason?: string;
  commissionRate: number; // e.g. 0.15 (15%)
  
  // Pix Data
  pixKeyType: PixKeyType;
  pixKey: string;
  
  // Social Channels & Strategy
  socialChannels: string;
  promotionStrategy: string;
  
  // Financial & Metrics
  balanceAvailable: number; // Available for withdrawal
  balancePending: number;   // Under clearance/draw period
  balancePaid: number;      // Total paid to date
  totalClicks: number;
  totalConversions: number;
  
  // Timestamps & LGPD
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
  destinationPath: string; // e.g. "/sorteio-de-hoje"
  campaignName: string;   // e.g. "instagram_stories"
  fullUrl: string;
  clicksCount: number;
  conversionsCount: number;
  revenueGenerated: number;
  isActive: boolean;
  createdAt: string;
}

export interface ClickRecord {
  id: string;
  affiliateId: string;
  affiliateCode: string;
  linkId?: string;
  campaign?: string;
  destinationUrl: string;
  referrer: string;
  ipHash: string;
  userAgent: string;
  deviceType: 'mobile' | 'desktop' | 'tablet';
  timestamp: string;
}

export interface ConversionRecord {
  id: string;
  orderId: string;
  affiliateId: string;
  affiliateCode: string;
  campaign?: string;
  ticketsCount: number;
  orderAmount: number;
  commissionAmount: number;
  buyerDocumentMasked: string;
  status: 'pendente' | 'aprovada' | 'cancelada';
  createdAt: string;
}

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

export interface PaymentRequest {
  id: string;
  affiliateId: string;
  affiliateName: string;
  affiliateDocument: string;
  requestedAmount: number;
  pixKeyType: PixKeyType;
  pixKey: string;
  status: PaymentStatus;
  pixTransactionId?: string;
  paymentReceiptUrl?: string;
  rejectionReason?: string;
  requestedAt: string;
  processedAt?: string;
  processedBy?: string;
}

export interface PromotionalMaterial {
  id: string;
  title: string;
  category: 'banner' | 'feed' | 'stories' | 'copy' | 'video' | 'selo';
  fileType: 'image' | 'video' | 'text';
  fileUrl: string;
  previewUrl?: string;
  captionText?: string;
  dimensions?: string;
  isActive: boolean;
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'payment';
  isRead: boolean;
  linkAction?: string;
  createdAt: string;
}

export interface SystemSettings {
  defaultCommissionRate: number;
  minimumPayoutAmount: number;
  cookieDurationDays: number;
  autoApproveAffiliates: boolean;
  supportWhatsapp: string;
  maintenanceMode: boolean;
}

export interface AuditLog {
  id: string;
  adminId: string;
  adminEmail: string;
  action: string;
  targetId: string;
  details: Record<string, any>;
  timestamp: string;
}
