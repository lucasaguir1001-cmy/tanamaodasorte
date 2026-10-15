import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { affiliateId, action, rejectionReason, approvedBy, commissionRate, newRate } = body;

    if (!affiliateId || !action) {
      return NextResponse.json(
        { success: false, error: 'Parâmetros inválidos.' },
        { status: 400 }
      );
    }

    if (action === 'update_rate' || action === 'update_commission') {
      const rateToSet = Number(commissionRate !== undefined ? commissionRate : newRate);
      if (isNaN(rateToSet) || rateToSet <= 0) {
        return NextResponse.json(
          { success: false, error: 'Taxa de comissão inválida.' },
          { status: 400 }
        );
      }
      const result = await DatabaseService.updateAffiliateCommissionRate(affiliateId, rateToSet);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error || 'Erro ao atualizar comissão no banco de dados.' },
          { status: 400 }
        );
      }
      return NextResponse.json({
        success: true,
        message: `Comissão atualizada para ${(rateToSet * 100).toFixed(0)}% com sucesso.`
      });
    }

    let status: 'aprovado' | 'recusado' | 'suspenso' | 'pendente' = 'pendente';
    if (action === 'approve') status = 'aprovado';
    else if (action === 'reject') status = 'recusado';
    else if (action === 'suspend') status = 'suspenso';
    else if (action === 'reactivate') status = 'aprovado';

    const result = await DatabaseService.updateAffiliateStatus(affiliateId, status, rejectionReason, approvedBy);
    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Erro ao atualizar afiliado no banco de dados.' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `Status atualizado para ${status} com sucesso.`
    });
  } catch (error: any) {
    console.error('Erro na API de ação de afiliado:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao atualizar afiliado no banco de dados.' },
      { status: 500 }
    );
  }
}
