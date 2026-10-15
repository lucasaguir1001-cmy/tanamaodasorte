import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { DatabaseService } from '@/lib/db';
import { Affiliate } from '@/types';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      fullName,
      email,
      password,
      documentType,
      documentNumber,
      phone,
      whatsapp,
      birthDate,
      city,
      state,
      pixKeyType,
      pixKey,
      socialChannels,
      promotionStrategy,
      termsAcceptedAt,
      privacyAcceptedAt,
      parentAffiliateCode,
      parentAffiliateId,
      commissionRate
    } = body;

    if (!fullName || !email || !documentNumber || !phone || !whatsapp) {
      return NextResponse.json(
        { success: false, error: 'Campos obrigatórios não preenchidos.' },
        { status: 400 }
      );
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanDoc = documentNumber.replace(/\D/g, '');

    // Verifica se já existe por e-mail ou documento
    const existing = await DatabaseService.getAffiliateByIdOrDoc(cleanEmail);
    if (existing) {
      return NextResponse.json(
        { success: false, error: 'Este e-mail ou CPF/CNPJ já possui cadastro.' },
        { status: 400 }
      );
    }

    // Processa vínculo de indicação/patrocinador (sub-afiliado)
    let parentAff = null;
    if (parentAffiliateCode || parentAffiliateId) {
      const codeOrId = (parentAffiliateCode || parentAffiliateId || '').trim();
      parentAff = await DatabaseService.getAffiliateByIdOrDoc(codeOrId);
    }

    // Calcula taxa de comissão definida pelo patrocinador ou padrão
    let finalRate = 0.15;
    if (commissionRate !== undefined && commissionRate !== null) {
      const parsedRate = Number(commissionRate);
      if (!isNaN(parsedRate)) {
        finalRate = parsedRate > 1 ? parsedRate / 100 : parsedRate;
      }
    } else if (parentAff) {
      finalRate = 0.10; // Padrão de 10% para sub-afiliados indicados
    }

    // Gera código exclusivo único
    const prefix = fullName.trim().split(' ')[0].toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'LUCK';
    const randNum = Math.floor(1000 + Math.random() * 9000);
    const code = `${prefix}-${randNum}`;

    const newAffiliate: Affiliate = {
      id: randomUUID(),
      fullName: fullName.trim(),
      email: cleanEmail,
      password: password || '',
      documentType: documentType || 'CPF',
      documentNumber: cleanDoc,
      phone: phone.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, ''),
      birthDate: birthDate || undefined,
      city: (city || '').trim(),
      state: (state || '').trim(),
      exclusiveCode: code,
      // Se foi indicado diretamente por um afiliado ativo, já inicia aprovado
      status: parentAff ? 'aprovado' : 'pendente',
      commissionRate: Number(finalRate.toFixed(4)),
      pixKeyType: pixKeyType || 'CPF',
      pixKey: (pixKey || '').trim(),
      socialChannels: (socialChannels || '').trim(),
      promotionStrategy: (promotionStrategy || '').trim(),
      balanceAvailable: 0,
      balancePending: 0,
      balancePaid: 0,
      totalClicks: 0,
      totalConversions: 0,
      parentAffiliateId: parentAff?.id,
      parentAffiliateCode: parentAff?.exclusiveCode,
      parentAffiliateName: parentAff?.fullName,
      termsAcceptedAt: termsAcceptedAt || new Date().toISOString(),
      privacyAcceptedAt: privacyAcceptedAt || new Date().toISOString(),
      createdAt: new Date().toISOString(),
      approvedAt: parentAff ? new Date().toISOString() : undefined,
      approvedBy: parentAff ? `Afiliado Patrocinador: ${parentAff.exclusiveCode}` : undefined
    };

    const result = await DatabaseService.saveAffiliate(newAffiliate);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao salvar no banco de dados.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      affiliate: result.affiliate
    });
  } catch (error: any) {
    console.error('Erro na API de cadastro de afiliado:', error);
    return NextResponse.json(
      { success: false, error: 'Erro interno ao processar cadastro no banco de dados.' },
      { status: 500 }
    );
  }
}
