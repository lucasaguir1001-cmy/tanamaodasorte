import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parent = searchParams.get('parent')?.trim().toUpperCase();

    let affiliates = await DatabaseService.getAffiliates();

    if (parent) {
      affiliates = affiliates.filter(a =>
        (a.parentAffiliateCode && a.parentAffiliateCode.toUpperCase() === parent) ||
        (a.parentAffiliateId && a.parentAffiliateId.toUpperCase() === parent)
      );
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
