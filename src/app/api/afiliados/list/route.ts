import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parent = searchParams.get('parent')?.trim().toUpperCase();
    const parentId = searchParams.get('parentId')?.trim();

    let affiliates = await DatabaseService.getAffiliates();

    if (parent || parentId) {
      affiliates = affiliates.filter(a => {
        const pCode = (a.parentAffiliateCode || '').trim().toUpperCase();
        const pId = (a.parentAffiliateId || '').trim();
        const strat = (a.promotionStrategy || '').toUpperCase();

        const matchCode = Boolean(parent && pCode && pCode === parent);
        const matchId = Boolean(parent && pId && pId.toUpperCase() === parent);
        const matchExplicitId = Boolean(parentId && pId && pId.toLowerCase() === parentId.toLowerCase());
        const matchStrategy = Boolean(parent && strat && strat.includes(parent));

        return matchCode || matchId || matchExplicitId || matchStrategy;
      });
    }

    return NextResponse.json({
      success: true,
      affiliates,
      total: affiliates.length
    });
  } catch (error: any) {
    console.error('Erro na API de listagem de afiliados:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar afiliados no banco de dados.' },
      { status: 500 }
    );
  }
}
