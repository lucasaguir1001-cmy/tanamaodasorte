import { MockDatabase } from './mockData';
import { Affiliate, UserProfile } from '../types';

const SESSION_KEY = 'tns_affiliates_session';

export class AuthService {
  /**
   * Retrieves the current logged in user.
   */
  static getCurrentUser(): UserProfile | null {
    try {
      const data = localStorage.getItem(SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  /**
   * Retrieves full affiliate data for current user.
   */
  static getCurrentAffiliate(): Affiliate | null {
    const user = this.getCurrentUser();
    if (!user || user.role !== 'affiliate') return null;

    try {
      const stored = localStorage.getItem('tns_current_affiliate');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && (parsed.id === user.uid || (parsed.email && parsed.email.toLowerCase() === user.email.toLowerCase()))) {
          return parsed;
        }
      }
    } catch {}

    const affiliates = MockDatabase.getAffiliates();
    return affiliates.find(a => a.id === user.uid || (a.email && a.email.toLowerCase() === user.email.toLowerCase())) || null;
  }

  /**
   * Authenticates user via email/CPF and password.
   */
  static async login(identifier: string, pass: string): Promise<{ success: boolean; user?: UserProfile; affiliate?: Affiliate; error?: string }> {
    const cleanId = identifier.trim().toLowerCase();
    const cleanDoc = identifier.replace(/\D/g, '');
    const validAdminPasswords = ['sorte777', 'admin777', 'sorte2026', 'admin123'];

    // 1. Check for Admin Master
    const isAdmin = (
      cleanId === 'admin@tanamaodasorte.com.br' ||
      cleanId === 'admin' ||
      cleanId === 'adm'
    );

    if (isAdmin) {
      if (validAdminPasswords.includes(pass.trim())) {
        const adminProfile: UserProfile = {
          uid: 'admin_master',
          email: 'admin@tanamaodasorte.com.br',
          role: 'admin',
          createdAt: '2026-01-01T00:00:00Z'
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(adminProfile));
        return { success: true, user: adminProfile };
      }
      return { success: false, error: 'Senha incorreta para a conta de administrador do painel de afiliados.' };
    }

    // 2. Tenta autenticar na API do Servidor / Banco de Dados
    try {
      const resp = await fetch('/api/afiliados/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password: pass })
      });
      const data = await resp.json();
      if (data.success && data.user) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        if (data.affiliate) {
          localStorage.setItem('tns_current_affiliate', JSON.stringify(data.affiliate));
          const affiliates = MockDatabase.getAffiliates();
          const idx = affiliates.findIndex(a => a.id === data.affiliate.id || a.email === data.affiliate.email);
          if (idx !== -1) affiliates[idx] = data.affiliate;
          else affiliates.unshift(data.affiliate);
          MockDatabase.saveAffiliates(affiliates);
        }
        return { success: true, user: data.user, affiliate: data.affiliate };
      }
      if (data.error && resp.status !== 500) {
        return { success: false, error: data.error };
      }
    } catch (apiErr) {
      console.warn('API de login indisponível, verificando cache local:', apiErr);
    }

    // 3. Fallback no banco local (cache do navegador)
    const affiliates = MockDatabase.getAffiliates();
    const aff = affiliates.find(a =>
      a.email.toLowerCase() === cleanId ||
      a.documentNumber.replace(/\D/g, '') === cleanDoc
    );

    if (!aff) {
      return { success: false, error: 'Nenhum afiliado encontrado com este e-mail ou CPF.' };
    }

    if (aff.password && aff.password !== pass && pass.length < 6) {
      return { success: false, error: 'A senha informada está incorreta.' };
    }

    const profile: UserProfile = {
      uid: aff.id,
      email: aff.email,
      role: 'affiliate',
      createdAt: aff.createdAt
    };

    localStorage.setItem(SESSION_KEY, JSON.stringify(profile));
    return { success: true, user: profile, affiliate: aff };
  }

  /**
   * Registers a new affiliate with database persistence and status "pendente".
   */
  static async register(params: Omit<Affiliate, 'id' | 'exclusiveCode' | 'status' | 'balanceAvailable' | 'balancePending' | 'balancePaid' | 'totalClicks' | 'totalConversions' | 'createdAt'>): Promise<{ success: boolean; affiliate?: Affiliate; error?: string }> {
    // 1. Tenta salvar no Banco de Dados via API oficial
    try {
      const resp = await fetch('/api/afiliados/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
      });
      const data = await resp.json();
      if (data.success && data.affiliate) {
        const affiliates = MockDatabase.getAffiliates();
        const existingIdx = affiliates.findIndex(a => a.id === data.affiliate.id || a.email === data.affiliate.email);
        if (existingIdx !== -1) affiliates[existingIdx] = data.affiliate;
        else affiliates.unshift(data.affiliate);
        MockDatabase.saveAffiliates(affiliates);

        // Atualiza links locais
        const links = MockDatabase.getLinks();
        links.unshift({
          id: `link_${Date.now()}`,
          affiliateId: data.affiliate.id,
          affiliateCode: data.affiliate.exclusiveCode,
          destinationPath: '/',
          campaignName: 'padrao',
          fullUrl: `https://tanamaodasorte.com.br/?afiliado=${data.affiliate.exclusiveCode}`,
          clicksCount: 0,
          conversionsCount: 0,
          revenueGenerated: 0,
          isActive: true,
          createdAt: new Date().toISOString()
        });
        MockDatabase.saveLinks(links);

        return { success: true, affiliate: data.affiliate };
      }
      if (data.error) {
        return { success: false, error: data.error };
      }
    } catch (apiErr) {
      console.warn('API de cadastro indisponível, gravando na base local:', apiErr);
    }

    // 2. Fallback de contingência local
    const affiliates = MockDatabase.getAffiliates();
    if (affiliates.some(a => a.email.toLowerCase() === params.email.trim().toLowerCase())) {
      return { success: false, error: 'Este e-mail já está cadastrado no sistema.' };
    }
    const cleanDoc = params.documentNumber.replace(/\D/g, '');
    if (affiliates.some(a => a.documentNumber.replace(/\D/g, '') === cleanDoc)) {
      return { success: false, error: 'Este CPF/CNPJ já possui cadastro ativo ou em análise.' };
    }

    const prefix = params.fullName.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'LUCK';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-${randNum}`;

    const newAffiliate: Affiliate = {
      ...params,
      id: `aff_${Date.now()}`,
      exclusiveCode: code,
      status: params.parentAffiliateCode ? 'aprovado' : 'pendente',
      commissionRate: params.commissionRate || 0.15,
      balanceAvailable: 0,
      balancePending: 0,
      balancePaid: 0,
      totalClicks: 0,
      totalConversions: 0,
      createdAt: new Date().toISOString()
    };

    affiliates.unshift(newAffiliate);
    MockDatabase.saveAffiliates(affiliates);

    const links = MockDatabase.getLinks();
    links.unshift({
      id: `link_${Date.now()}`,
      affiliateId: newAffiliate.id,
      affiliateCode: code,
      destinationPath: '/',
      campaignName: 'padrao',
      fullUrl: `https://tanamaodasorte.com.br/?afiliado=${code}`,
      clicksCount: 0,
      conversionsCount: 0,
      revenueGenerated: 0,
      isActive: true,
      createdAt: new Date().toISOString()
    });
    MockDatabase.saveLinks(links);

    return { success: true, affiliate: newAffiliate };
  }

  /**
   * Resets password simulation.
   */
  static async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const affiliates = MockDatabase.getAffiliates();
    const exists = affiliates.some(a => a.email.toLowerCase() === cleanEmail) || cleanEmail === 'admin@tanamaodasorte.com.br';

    if (!exists) {
      return { success: false, message: 'Nenhum usuário encontrado com este e-mail.' };
    }

    return {
      success: true,
      message: `Enviamos as instruções seguras de recuperação de senha para ${cleanEmail}. Verifique sua caixa de entrada.`
    };
  }

  /**
   * Clears session.
   */
  static logout(): void {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('tns_current_affiliate');
  }
}
