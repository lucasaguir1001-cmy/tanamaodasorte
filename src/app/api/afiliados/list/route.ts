import { NextResponse } from 'next/server';
import { DatabaseService } from '@/lib/db';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const parent = searchParams.get('parent')?.trim().toUpperCase();
    const parentId = searchParams.get('parentId')?.trim();

    const allAffiliates = await DatabaseService.getAffiliates();

    if (!parent && !parentId) {
      return NextResponse.json({
        success: true,
        affiliates: allAffiliates,
        total: allAffiliates.length
      });
    }

    // Mapas para busca rápida
    const byId = new Map<string, any>();
    const byCode = new Map<string, any>();

    allAffiliates.forEach(a => {
      if (a.id) byId.set(a.id.toLowerCase(), a);
      if (a.exclusiveCode) byCode.set(a.exclusiveCode.toUpperCase(), a);
    });

    // Identifica o afiliado raiz (patrocinador do topo da consulta)
    const rootAffiliate =
      (parent ? byCode.get(parent) : undefined) ||
      (parentId ? byId.get(parentId.toLowerCase()) : undefined) ||
      (parent ? byId.get(parent.toLowerCase()) : undefined) ||
      allAffiliates.find(a =>
        (parent && a.exclusiveCode?.toUpperCase() === parent) ||
        (parentId && a.id?.toLowerCase() === parentId.toLowerCase())
      );

    const rootCode = (rootAffiliate?.exclusiveCode || parent || '').toUpperCase();
    const rootId = (rootAffiliate?.id || parentId || '').toLowerCase();
    const rootName = rootAffiliate?.fullName || 'Você';

    // Função de verificação se 'child' foi indicado diretamente por um dado patrocinador (código ou id)
    const isDirectChildOf = (child: any, sponsorCode: string, sponsorId: string): boolean => {
      if (!child) return false;
      const childCode = (child.exclusiveCode || '').toUpperCase();
      const childId = (child.id || '').toLowerCase();

      // Não pode ser o próprio afiliado
      if (childCode && sponsorCode && childCode === sponsorCode) return false;
      if (childId && sponsorId && childId === sponsorId) return false;

      const pCode = (child.parentAffiliateCode || '').trim().toUpperCase();
      const pId = (child.parentAffiliateId || '').trim().toLowerCase();
      const strat = (child.promotionStrategy || '').toUpperCase();

      if (sponsorCode && pCode && pCode === sponsorCode) return true;
      if (sponsorId && pId && pId === sponsorId) return true;
      if (sponsorCode && pId && pId === sponsorCode.toLowerCase()) return true;
      if (sponsorCode && strat && strat.includes(sponsorCode)) return true;

      return false;
    };

    // Fila BFS para coleta de todos os níveis da rede (Nível 1 = diretos, Nível 2 = sub do sub, etc.)
    const downlineList: any[] = [];
    const visitedIds = new Set<string>();

    if (rootId) visitedIds.add(rootId);
    if (rootCode) visitedIds.add(rootCode);

    type QueueItem = {
      affiliate: any;
      level: number;
      sponsorName: string;
      sponsorCode: string;
    };

    const queue: QueueItem[] = [];

    // Nível 1: Afiliados diretos do usuário
    allAffiliates.forEach(candidate => {
      const candKey = candidate.id?.toLowerCase() || candidate.exclusiveCode?.toUpperCase();
      if (!candKey || visitedIds.has(candKey)) return;

      if (isDirectChildOf(candidate, rootCode, rootId)) {
        visitedIds.add(candKey);
        if (candidate.id) visitedIds.add(candidate.id.toLowerCase());
        if (candidate.exclusiveCode) visitedIds.add(candidate.exclusiveCode.toUpperCase());

        const enriched = {
          ...candidate,
          networkLevel: 1,
          sponsorName: rootName,
          sponsorCode: rootCode,
          isDirect: true
        };

        queue.push({
          affiliate: candidate,
          level: 1,
          sponsorName: candidate.fullName || candidate.exclusiveCode,
          sponsorCode: candidate.exclusiveCode
        });

        downlineList.push(enriched);
      }
    });

    // Níveis subsequentes: Nível 2 (afiliados de afiliados), Nível 3, etc.
    let maxSafetyCounter = 2000;
    while (queue.length > 0 && maxSafetyCounter > 0) {
      maxSafetyCounter--;
      const current = queue.shift()!;
      const curParentCode = (current.affiliate.exclusiveCode || '').toUpperCase();
      const curParentId = (current.affiliate.id || '').toLowerCase();
      const curParentName = current.affiliate.fullName || curParentCode;
      const nextLevel = current.level + 1;

      allAffiliates.forEach(candidate => {
        const candKey = candidate.id?.toLowerCase() || candidate.exclusiveCode?.toUpperCase();
        if (!candKey || visitedIds.has(candKey)) return;

        if (isDirectChildOf(candidate, curParentCode, curParentId)) {
          visitedIds.add(candKey);
          if (candidate.id) visitedIds.add(candidate.id.toLowerCase());
          if (candidate.exclusiveCode) visitedIds.add(candidate.exclusiveCode.toUpperCase());

          const enriched = {
            ...candidate,
            networkLevel: nextLevel,
            sponsorName: curParentName,
            sponsorCode: curParentCode,
            isDirect: false
          };

          queue.push({
            affiliate: candidate,
            level: nextLevel,
            sponsorName: candidate.fullName || candidate.exclusiveCode,
            sponsorCode: candidate.exclusiveCode
          });

          downlineList.push(enriched);
        }
      });
    }

    return NextResponse.json({
      success: true,
      affiliates: downlineList,
      total: downlineList.length
    });
  } catch (error: any) {
    console.error('Erro na API de listagem de afiliados:', error);
    return NextResponse.json(
      { success: false, error: 'Erro ao buscar afiliados no banco de dados.' },
      { status: 500 }
    );
  }
}
