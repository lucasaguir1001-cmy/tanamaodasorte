import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { supabase, isSupabaseConfigured } from './supabase';
import { Usuario, Bilhete, Sorteio, Mensagem, Affiliate, AffiliateLink, AffiliateStatus, Commission, TicketReservation, SorteadoProgramado } from '@/types';
import { WhatsAppTemplates, sendWhatsAppMessage } from './whatsapp';
import { checkPaymentStatus } from './mercadopago';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

interface DatabaseSchema {
  usuarios: Usuario[];
  bilhetes: Bilhete[];
  sorteios: Sorteio[];
  mensagens: Mensagem[];
  afiliados: Affiliate[];
  afiliados_links: AffiliateLink[];
  comissoes: Commission[];
  reservas: TicketReservation[];
  sorteado_programado?: SorteadoProgramado | null;
}

const DEFAULT_DB: DatabaseSchema = {
  usuarios: [
    {
      id: 'usr_seed_1',
      nome_completo: 'Carlos Eduardo Mendes',
      cpf: '12345678900',
      whatsapp: '11987654321',
      data_cadastro: '2026-09-24T10:00:00Z'
    },
    {
      id: 'usr_seed_2',
      nome_completo: 'Mariana Silva Santos',
      cpf: '23456789011',
      whatsapp: '21976543210',
      data_cadastro: '2026-09-24T14:30:00Z'
    },
    {
      id: 'usr_seed_3',
      nome_completo: 'Roberto Oliveira Lima',
      cpf: '34567890122',
      whatsapp: '31985432109',
      data_cadastro: '2026-09-24T16:15:00Z'
    }
  ],
  bilhetes: [],
  sorteios: [
    {
      id: 'sorteio_hoje',
      data_sorteio: new Date(new Date().setHours(19, 0, 0, 0)).toISOString(),
      numeros_sorteados: null,
      ganhador_id: null,
      premio: 500,
      acumulado: false,
      status: 'agendado',
      eh_domingo: new Date().getDay() === 0
    }
  ],
  mensagens: [],
  afiliados: [],
  afiliados_links: [],
  comissoes: [],
  reservas: [],
  sorteado_programado: null
};

/**
 * Lê o banco de dados local com garantia de integridade
 */
function readLocalDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(DEFAULT_DB, null, 2), 'utf-8');
      return DEFAULT_DB;
    }
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed.usuarios) parsed.usuarios = [];
    if (!parsed.bilhetes) parsed.bilhetes = [];
    if (!parsed.sorteios) parsed.sorteios = [];
    if (!parsed.mensagens) parsed.mensagens = [];
    if (!parsed.afiliados) parsed.afiliados = [];
    if (!parsed.afiliados_links) parsed.afiliados_links = [];
    if (!parsed.comissoes) parsed.comissoes = [];
    if (!parsed.reservas) parsed.reservas = [];
    if (parsed.sorteado_programado === undefined) parsed.sorteado_programado = null;
    return parsed;
  } catch (err) {
    console.error('Erro ao ler DB local:', err);
    return DEFAULT_DB;
  }
}

/**
 * Salva no banco de dados local
 */
function writeLocalDb(data: DatabaseSchema): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Erro ao gravar DB local:', err);
  }
}

export class DatabaseService {
  /**
   * Captura e salva o participante (Nome, CPF, WhatsApp) e seus bilhetes
   * Persiste no Supabase e no banco local simultaneamente.
   */
  static async saveParticipant(params: {
    nome_completo: string;
    cpf: string;
    whatsapp: string;
    tickets: string[];
    paymentId?: string;
    affiliateCode?: string;
    campaign?: string;
  }): Promise<{ user: Usuario; newTickets: Bilhete[]; commission?: Commission }> {
    const cleanCpf = params.cpf.replace(/\D/g, '');
    const cleanPhone = params.whatsapp.replace(/\D/g, '');
    const cleanName = params.nome_completo.trim();

    const localDb = readLocalDb();
    
    // 1. Localiza ou cria o usuário
    let user = localDb.usuarios.find(u => u.cpf.replace(/\D/g, '') === cleanCpf);
    if (!user) {
      user = {
        id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        nome_completo: cleanName,
        cpf: cleanCpf,
        whatsapp: cleanPhone,
        data_cadastro: new Date().toISOString()
      };
      localDb.usuarios.push(user);
    } else {
      user.nome_completo = cleanName;
      user.cpf = cleanCpf;
      user.whatsapp = cleanPhone;
    }

    // 2. Localiza o sorteio ativo oficial (Supabase ou local)
    let drawId = 'sorteio_hoje';
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: activeDraws } = await supabase
          .from('sorteios')
          .select('id')
          .in('status', ['agendado', 'em_andamento'])
          .order('data_sorteio', { ascending: true })
          .limit(1);

        if (activeDraws && activeDraws.length > 0 && activeDraws[0].id) {
          drawId = activeDraws[0].id;
        }
      } catch (e) {
        console.warn('Erro ao consultar sorteio ativo para bilhete:', e);
      }
    }
    if (drawId === 'sorteio_hoje') {
      const currentDraw = localDb.sorteios[localDb.sorteios.length - 1];
      if (currentDraw) drawId = currentDraw.id;
    }

    // 3. Cria os bilhetes comprados evitando duplicações acidentais
    const uniqueRequestedNumbers = [...new Set(params.tickets)];
    const existingMilhares = new Set(
      (localDb.bilhetes || [])
        .filter(b => b.sorteio_id === drawId && b.usuario_id === user!.id)
        .map(b => b.numero_milhar)
    );

    const toInsert = uniqueRequestedNumbers.filter(n => !existingMilhares.has(n));
    const newTickets: Bilhete[] = toInsert.map(num => ({
      id: `bilhete_${Date.now()}_${num}`,
      numero_milhar: num,
      usuario_id: user!.id,
      sorteio_id: drawId,
      data_compra: new Date().toISOString(),
      status_pagamento: true,
      payment_id: params.paymentId,
      valor: 2.00,
      usuario: user
    }));

    if (newTickets.length > 0) {
      localDb.bilhetes.push(...newTickets);
      writeLocalDb(localDb);
    }

    // 4. Se o Supabase estiver configurado com credenciais válidas, sincroniza na nuvem
    if (isSupabaseConfigured && supabase) {
      try {
        let supabaseUserId = user.id;

        // Localiza se o usuário já existe na nuvem pelo CPF
        const { data: existingUser } = await supabase
          .from('usuarios')
          .select('id')
          .eq('cpf', cleanCpf)
          .maybeSingle();

        if (existingUser && existingUser.id) {
          supabaseUserId = existingUser.id;
          await supabase
            .from('usuarios')
            .update({
              nome_completo: user.nome_completo,
              whatsapp: user.whatsapp
            })
            .eq('id', supabaseUserId);
        } else {
          await supabase.from('usuarios').insert({
            id: supabaseUserId,
            nome_completo: user.nome_completo,
            cpf: user.cpf,
            whatsapp: user.whatsapp,
            data_cadastro: user.data_cadastro
          });
        }

        // Insere os bilhetes comprados vinculando ao usuário sem duplicar
        if (newTickets.length > 0) {
          const { data: existingSbTickets } = await supabase
            .from('bilhetes')
            .select('numero_milhar')
            .eq('sorteio_id', drawId)
            .eq('usuario_id', supabaseUserId)
            .in('numero_milhar', newTickets.map(t => t.numero_milhar));

          const existingSbMilhares = new Set((existingSbTickets || []).map(b => b.numero_milhar));
          const sbToInsert = newTickets
            .filter(t => !existingSbMilhares.has(t.numero_milhar))
            .map(t => ({
              id: t.id,
              numero_milhar: t.numero_milhar,
              usuario_id: supabaseUserId,
              sorteio_id: t.sorteio_id,
              data_compra: t.data_compra,
              status_pagamento: t.status_pagamento,
              valor: t.valor
            }));

          if (sbToInsert.length > 0) {
            await supabase.from('bilhetes').insert(sbToInsert);
          }
        }
      } catch (err) {
        console.warn('Erro ao sincronizar com Supabase:', err);
      }
    }

    let commission: Commission | undefined = undefined;
    const totalTicketsCount = params.tickets && params.tickets.length > 0 ? params.tickets.length : newTickets.length;
    const finalTicketsList = params.tickets && params.tickets.length > 0 ? params.tickets : newTickets.map(t => t.numero_milhar);

    if (params.affiliateCode && totalTicketsCount > 0) {
      try {
        const saleResult = await this.recordAffiliateSale({
          affiliateCode: params.affiliateCode,
          orderAmount: totalTicketsCount * 2.00,
          ticketsCount: totalTicketsCount,
          tickets: finalTicketsList,
          buyerName: user.nome_completo,
          buyerCpf: user.cpf,
          paymentId: params.paymentId,
          campaign: params.campaign
        });
        if (saleResult.success && saleResult.commission) {
          commission = saleResult.commission;
        }
      } catch (affErr) {
        console.error('Erro ao registrar comissão de afiliado na compra:', affErr);
      }
    }

    return { user, newTickets, commission };
  }

  /**
   * Consulta participante e todos os bilhetes ativos pelo CPF (sem duplicatas)
   */
  static async getTicketsByCpf(rawCpf: string): Promise<{ user: Usuario | null; tickets: Bilhete[] }> {
    const cleanCpf = rawCpf.replace(/\D/g, '');
    if (!cleanCpf) {
      return { user: null, tickets: [] };
    }

    const localDb = readLocalDb();
    let foundUser: Usuario | null = null;
    let tickets: Bilhete[] = [];

    // Localiza o sorteio ativo oficial (bilhetes de rodadas anteriores não são exibidos)
    let activeDrawId: string | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: activeDraws } = await supabase
          .from('sorteios')
          .select('id')
          .in('status', ['agendado', 'em_andamento'])
          .order('data_sorteio', { ascending: true })
          .limit(1);
        if (activeDraws && activeDraws.length > 0 && activeDraws[0].id) {
          activeDrawId = activeDraws[0].id;
        }
      } catch (e) {}
    }
    if (!activeDrawId) {
      const currentLocal = localDb.sorteios.find(s => s.status === 'agendado' || s.status === 'em_andamento');
      if (currentLocal) activeDrawId = currentLocal.id;
    }

    // 1. Tenta buscar no Supabase (Fonte de Verdade Principal)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: users, error: userErr } = await supabase
          .from('usuarios')
          .select('*')
          .eq('cpf', cleanCpf)
          .limit(1);

        if (!userErr && users && users.length > 0) {
          foundUser = users[0] as Usuario;
        }

        if (foundUser) {
          let query = supabase
            .from('bilhetes')
            .select('*, usuario:usuarios(*)')
            .eq('usuario_id', foundUser.id)
            .eq('status_pagamento', true);

          if (activeDrawId) {
            query = query.eq('sorteio_id', activeDrawId);
          }

          let { data: tData, error: tErr } = await query.order('data_compra', { ascending: false });

          // Fallback 1: se o join falhou no PostgREST, faz select(*) simples
          if (tErr || !tData) {
            let fallbackQ = supabase
              .from('bilhetes')
              .select('*')
              .eq('usuario_id', foundUser.id)
              .eq('status_pagamento', true);
            if (activeDrawId) {
              fallbackQ = fallbackQ.eq('sorteio_id', activeDrawId);
            }
            const resFallback = await fallbackQ.order('data_compra', { ascending: false });
            if (!resFallback.error && resFallback.data) {
              tData = resFallback.data;
              tErr = null;
            }
          }

          // Fallback 2: se filtrou por activeDrawId e não achou nada, busca todos os bilhetes pagos desse usuário
          if ((!tData || tData.length === 0) && activeDrawId) {
            const anyQ = await supabase
              .from('bilhetes')
              .select('*')
              .eq('usuario_id', foundUser.id)
              .eq('status_pagamento', true)
              .order('data_compra', { ascending: false });
            if (!anyQ.error && anyQ.data && anyQ.data.length > 0) {
              tData = anyQ.data;
            }
          }

          if (tData) {
            tickets = tData as Bilhete[];
            tickets.forEach(t => {
              if (!t.usuario && foundUser) t.usuario = foundUser;
            });
          }

          // Se encontrou dados no Supabase, deduplica estritamente por número da milhar e retorna direto
          const uniqueMap = new Map<string, Bilhete>();
          for (const t of tickets) {
            if (!uniqueMap.has(t.numero_milhar)) {
              uniqueMap.set(t.numero_milhar, t);
            }
          }
          return { user: foundUser, tickets: Array.from(uniqueMap.values()) };
        }
      } catch (err) {
        console.warn('Erro ao consultar CPF no Supabase:', err);
      }
    }

    // 2. Fallback com o banco local caso Supabase falhe ou usuário só exista local
    if (!foundUser) {
      foundUser = localDb.usuarios.find(u => u.cpf.replace(/\D/g, '') === cleanCpf) || null;
    }

    if (foundUser) {
      const localTickets = (localDb.bilhetes || []).filter(
        b => (b.usuario_id === foundUser?.id || b.usuario?.cpf?.replace(/\D/g, '') === cleanCpf) &&
             b.status_pagamento &&
             (!activeDrawId || b.sorteio_id === activeDrawId)
      );

      for (const lt of localTickets) {
        tickets.push({ ...lt, usuario: foundUser });
      }
    }

    // 3. Deduplica estritamente por número da milhar
    const uniqueMap = new Map<string, Bilhete>();
    for (const t of tickets) {
      if (!uniqueMap.has(t.numero_milhar)) {
        uniqueMap.set(t.numero_milhar, t);
      }
    }

    return { user: foundUser, tickets: Array.from(uniqueMap.values()) };
  }

  /**
   * Retorna todos os participantes cadastrados
   */
  static async getParticipants(): Promise<Usuario[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('usuarios').select('*').order('data_cadastro', { ascending: false });
        if (!error && data && data.length > 0) {
          return data as Usuario[];
        }
      } catch (err) {
        console.warn('Erro ao consultar participantes no Supabase:', err);
      }
    }

    const localDb = readLocalDb();
    return localDb.usuarios;
  }

  /**
   * Retorna todos os bilhetes vendidos da rodada ativa (sem duplicatas, com dados do usuário)
   */
  static async getTickets(): Promise<Bilhete[]> {
    const localDb = readLocalDb();
    let activeDrawId: string | null = null;
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: activeDraws } = await supabase
          .from('sorteios')
          .select('id')
          .in('status', ['agendado', 'em_andamento'])
          .order('data_sorteio', { ascending: true })
          .limit(1);
        if (activeDraws && activeDraws.length > 0 && activeDraws[0].id) {
          activeDrawId = activeDraws[0].id;
        }
      } catch (e) {}
    }
    if (!activeDrawId) {
      const currentLocal = localDb.sorteios.find(s => s.status === 'agendado' || s.status === 'em_andamento');
      if (currentLocal) activeDrawId = currentLocal.id;
    }

    // 1. Tenta buscar no Supabase como fonte única de verdade
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('bilhetes')
          .select('*, usuario:usuarios(*)')
          .eq('status_pagamento', true);

        if (activeDrawId) {
          query = query.eq('sorteio_id', activeDrawId);
        }

        let { data, error } = await query.order('data_compra', { ascending: false });

        // Fallback 1: se join falhou no PostgREST, faz select(*) simples
        if (error || !data) {
          let fallbackQuery = supabase
            .from('bilhetes')
            .select('*')
            .eq('status_pagamento', true);
          if (activeDrawId) {
            fallbackQuery = fallbackQuery.eq('sorteio_id', activeDrawId);
          }
          const res = await fallbackQuery.order('data_compra', { ascending: false });
          if (!res.error && res.data) {
            data = res.data;
            error = null;
          }
        }

        // Fallback 2: se filtrou por activeDrawId e não achou nada, consulta bilhetes ativos mais recentes
        if ((!data || data.length === 0) && activeDrawId) {
          const anyActive = await supabase
            .from('bilhetes')
            .select('*')
            .eq('status_pagamento', true)
            .order('data_compra', { ascending: false })
            .limit(100);
          if (!anyActive.error && anyActive.data && anyActive.data.length > 0) {
            data = anyActive.data;
          }
        }

        if (data && data.length > 0) {
          const userIds = [...new Set((data as Bilhete[]).map(b => b.usuario_id).filter(Boolean))];
          let usersMap = new Map<string, Usuario>();
          if (userIds.length > 0 && !(data[0] as any).usuario) {
            try {
              const { data: usersData } = await supabase.from('usuarios').select('*').in('id', userIds);
              if (usersData) {
                usersData.forEach(u => usersMap.set(u.id, u as Usuario));
              }
            } catch {}
          }

          const map = new Map<string, Bilhete>();
          for (const b of data as Bilhete[]) {
            if (!b.usuario && b.usuario_id && usersMap.has(b.usuario_id)) {
              b.usuario = usersMap.get(b.usuario_id);
            }
            if (!map.has(b.numero_milhar)) {
              map.set(b.numero_milhar, b);
            }
          }
          return Array.from(map.values());
        }
      } catch (err) {
        console.warn('Erro ao consultar bilhetes no Supabase:', err);
      }
    }

    // 2. Fallback estrito apenas se Supabase não estiver disponível
    const map = new Map<string, Bilhete>();
    for (const b of (localDb.bilhetes || [])) {
      if (b.status_pagamento && (!activeDrawId || b.sorteio_id === activeDrawId) && !map.has(b.numero_milhar)) {
        if (!b.usuario && b.usuario_id) {
          const u = localDb.usuarios.find(user => user.id === b.usuario_id);
          if (u) b.usuario = u;
        }
        map.set(b.numero_milhar, b);
      }
    }

    return Array.from(map.values());
  }

  /**
   * Zera todos os bilhetes vendidos após a conclusão de um sorteio (com ou sem ganhador),
   * garantindo que os bilhetes comprados não sirvam para o próximo sorteio e a rodada reinicie do zero.
   */
  static async clearTickets(): Promise<void> {
    const localDb = readLocalDb();
    localDb.bilhetes = [];
    writeLocalDb(localDb);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('bilhetes').delete().neq('id', 'none_preserve');
      } catch (e) {
        console.warn('Erro ao zerar bilhetes no Supabase:', e);
      }
    }
  }

  /**
   * Retorna o sorteio ativo
   */
  static async getCurrentDraw(): Promise<Sorteio> {
    const localDb = readLocalDb();
    const current = localDb.sorteios[localDb.sorteios.length - 1];
    return current || DEFAULT_DB.sorteios[0];
  }

  /**
   * Retorna todas as mensagens enviadas
   */
  static async getMessages(): Promise<Mensagem[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        const { data, error } = await supabase.from('mensagens').select('*').order('data_envio', { ascending: false });
        if (!error && data && data.length > 0) {
          return data as Mensagem[];
        }
      } catch (err) {
        console.warn('Erro ao consultar mensagens no Supabase:', err);
      }
    }

    const localDb = readLocalDb();
    return localDb.mensagens;
  }

  /**
   * Dispara o lembrete diário para TODOS os participantes cadastrados
   * "Ainda dá tempo de comprar seu bilhete para o sorteio de hoje!"
   */
  static async broadcastDailyReminder(): Promise<{ count: number; messages: Mensagem[] }> {
    const participants = await this.getParticipants();
    const localDb = readLocalDb();
    const dispatchedMessages: Mensagem[] = [];

    const reminderContent = WhatsAppTemplates.lembrete();

    for (const user of participants) {
      const msg = await sendWhatsAppMessage({
        toPhone: user.whatsapp,
        recipientName: user.nome_completo,
        userId: user.id,
        content: reminderContent,
        type: 'lembrete'
      });

      dispatchedMessages.push(msg);
      localDb.mensagens.unshift(msg);

      // Salva no Supabase se disponível
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('mensagens').insert({
            id: msg.id,
            usuario_id: user.id,
            conteudo: msg.conteudo,
            tipo: msg.tipo,
            data_envio: msg.data_envio,
            status_envio: msg.status_envio
          });
        } catch (e) {
          console.warn('Erro ao gravar mensagem no Supabase:', e);
        }
      }
    }

    writeLocalDb(localDb);
    return { count: dispatchedMessages.length, messages: dispatchedMessages };
  }

  /**
   * Codifica senha, patrocinador e comissão no campo status para persistência garantida em qualquer schema Supabase
   */
  static encodeAffiliateStatus(affiliate: Partial<Affiliate>): string {
    const baseStatus = affiliate.status || 'aprovado';
    let str = `${baseStatus}`;
    if (affiliate.password) {
      str += `#pwd:${affiliate.password}`;
    }
    if (affiliate.parentAffiliateCode) {
      str += `#parent:${affiliate.parentAffiliateCode.trim().toUpperCase()}`;
    }
    if (affiliate.parentAffiliateId) {
      str += `#pid:${affiliate.parentAffiliateId.trim()}`;
    }
    if (affiliate.parentAffiliateName) {
      str += `#pname:${encodeURIComponent(affiliate.parentAffiliateName.trim())}`;
    }
    if (affiliate.commissionRate !== undefined && affiliate.commissionRate !== null) {
      str += `#rate:${affiliate.commissionRate}`;
    }
    return str;
  }

  /**
   * Decodifica status, senha, patrocinador e comissão codificados no campo status
   */
  static parseAffiliateStatus(statusStr: any): {
    status: AffiliateStatus;
    password?: string;
    parentAffiliateCode?: string;
    parentAffiliateId?: string;
    parentAffiliateName?: string;
    commissionRate?: number;
  } {
    if (!statusStr || typeof statusStr !== 'string') {
      return { status: 'aprovado' };
    }

    const parts = statusStr.split('#');
    let cleanStatus = (parts[0] || 'aprovado') as AffiliateStatus;
    if (!['aprovado', 'pendente', 'recusado', 'suspenso', 'cancelado'].includes(cleanStatus)) {
      cleanStatus = cleanStatus.toLowerCase().startsWith('aprov') ? 'aprovado' : 'pendente';
    }

    let password: string | undefined = undefined;
    let parentAffiliateCode: string | undefined = undefined;
    let parentAffiliateId: string | undefined = undefined;
    let parentAffiliateName: string | undefined = undefined;
    let commissionRate: number | undefined = undefined;

    for (let i = 1; i < parts.length; i++) {
      const chunk = parts[i];
      if (chunk.startsWith('pwd:')) {
        const rest = parts.slice(i).join('#');
        const nextTagIdx = rest.search(/#(parent|pid|pname|rate):/);
        if (nextTagIdx !== -1) {
          password = rest.substring(4, nextTagIdx);
        } else {
          password = rest.substring(4);
        }
      } else if (chunk.startsWith('parent:')) {
        parentAffiliateCode = chunk.substring(7).trim().toUpperCase();
      } else if (chunk.startsWith('pid:')) {
        parentAffiliateId = chunk.substring(4).trim();
      } else if (chunk.startsWith('pname:')) {
        try {
          parentAffiliateName = decodeURIComponent(chunk.substring(6).trim());
        } catch {
          parentAffiliateName = chunk.substring(6).trim();
        }
      } else if (chunk.startsWith('rate:')) {
        const parsed = parseFloat(chunk.substring(5).trim());
        if (!isNaN(parsed) && parsed > 0) {
          commissionRate = parsed > 1 ? parsed / 100 : parsed;
        }
      }
    }

    return {
      status: cleanStatus,
      password,
      parentAffiliateCode,
      parentAffiliateId,
      parentAffiliateName,
      commissionRate
    };
  }

  /**
   * Salva um novo afiliado no banco de dados (Local JSON e Supabase)
   */
  static async saveAffiliate(affiliate: Affiliate): Promise<{ success: boolean; affiliate?: Affiliate; error?: string }> {
    const localDb = readLocalDb();
    const cleanEmail = affiliate.email.trim().toLowerCase();
    const cleanDoc = affiliate.documentNumber.replace(/\D/g, '');

    // Garante que o ID é um UUID válido para compatibilidade universal com o Supabase
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(affiliate.id || '');
    if (!isUuid) {
      affiliate.id = randomUUID();
    }

    // Se possui patrocinador vinculado, garante status 'aprovado' para permitir acesso imediato ao painel
    if (affiliate.parentAffiliateCode || affiliate.parentAffiliateId) {
      affiliate.status = 'aprovado';
      if (!affiliate.approvedAt) affiliate.approvedAt = new Date().toISOString();
      if (!affiliate.approvedBy) affiliate.approvedBy = `Patrocinador: ${affiliate.parentAffiliateCode || affiliate.parentAffiliateId}`;
    }

    // Salva ou atualiza no banco local
    if (!localDb.afiliados) localDb.afiliados = [];
    const localIdx = localDb.afiliados.findIndex(a =>
      a.id === affiliate.id ||
      a.email.trim().toLowerCase() === cleanEmail ||
      (cleanDoc && a.documentNumber.replace(/\D/g, '') === cleanDoc)
    );

    if (localIdx !== -1) {
      localDb.afiliados[localIdx] = { ...localDb.afiliados[localIdx], ...affiliate };
    } else {
      localDb.afiliados.unshift(affiliate);
    }

    // Cria link padrão do afiliado se não existir
    if (!localDb.afiliados_links) localDb.afiliados_links = [];
    const existingLink = localDb.afiliados_links.find(l =>
      l.affiliateId === affiliate.id || l.affiliateCode.toUpperCase() === affiliate.exclusiveCode.toUpperCase()
    );
    if (!existingLink) {
      localDb.afiliados_links.unshift({
        id: `link_${Date.now()}`,
        affiliateId: affiliate.id,
        affiliateCode: affiliate.exclusiveCode,
        destinationPath: '/',
        campaignName: 'padrao',
        fullUrl: `https://tanamaodasorte.com.br/?afiliado=${affiliate.exclusiveCode}`,
        clicksCount: 0,
        conversionsCount: 0,
        revenueGenerated: 0,
        isActive: true,
        createdAt: new Date().toISOString()
      });
    }
    writeLocalDb(localDb);

    // Sincroniza com Supabase se configurado
    if (isSupabaseConfigured && supabase) {
      try {
        const encodedStatus = DatabaseService.encodeAffiliateStatus(affiliate);

        // 1. Tenta salvar na tabela 'afiliados' com todas as colunas
        const fullInsert = await supabase.from('afiliados').upsert({
          id: affiliate.id,
          full_name: affiliate.fullName,
          email: cleanEmail,
          password: affiliate.password || '',
          document_type: affiliate.documentType,
          document_number: cleanDoc,
          phone: affiliate.phone,
          whatsapp: affiliate.whatsapp,
          birth_date: affiliate.birthDate || null,
          city: affiliate.city,
          state: affiliate.state,
          exclusive_code: affiliate.exclusiveCode,
          status: affiliate.status,
          rejection_reason: affiliate.rejectionReason || null,
          commission_rate: affiliate.commissionRate,
          pix_key_type: affiliate.pixKeyType,
          pix_key: affiliate.pixKey,
          social_channels: affiliate.socialChannels,
          promotion_strategy: affiliate.promotionStrategy,
          balance_available: affiliate.balanceAvailable,
          balance_pending: affiliate.balancePending,
          balance_paid: affiliate.balancePaid,
          total_clicks: affiliate.totalClicks,
          total_conversions: affiliate.totalConversions,
          terms_accepted_at: affiliate.termsAcceptedAt,
          privacy_accepted_at: affiliate.privacyAcceptedAt,
          created_at: affiliate.createdAt,
          parent_affiliate_id: affiliate.parentAffiliateId || null,
          parent_affiliate_code: affiliate.parentAffiliateCode || null,
          parent_affiliate_name: affiliate.parentAffiliateName || null
        }, { onConflict: 'email' });

        if (fullInsert.error) {
          // Schema base de 5 colunas no Supabase: grava colunas essenciais codificando metadados no status
          const baseInsert = await supabase.from('afiliados').upsert({
            id: affiliate.id,
            email: cleanEmail,
            document_number: cleanDoc,
            exclusive_code: affiliate.exclusiveCode,
            status: encodedStatus
          }, { onConflict: 'email' });

          if (baseInsert.error) {
            console.error('Erro ao gravar afiliado base no Supabase:', baseInsert.error);
          }
        }

        // 2. Grava perfil completo em 'mensagens' (garante persistência de 100% dos dados mesmo em ambiente serverless)
        try {
          await supabase.from('mensagens').upsert({
            id: `aff_meta_${affiliate.id}`,
            destinatario_id: affiliate.id,
            telefone: cleanDoc || '00000000000',
            tipo: 'afiliado_perfil',
            conteudo: JSON.stringify(affiliate),
            status: affiliate.status,
            data_envio: affiliate.createdAt
          });
        } catch (mErr) {
          console.warn('Erro ao sincronizar aff_meta no Supabase:', mErr);
        }

        // 3. Salva em 'usuarios' para garantir persistência do nome, cpf e whatsapp na nuvem
        try {
          const { data: existingUser } = await supabase.from('usuarios').select('id').eq('cpf', cleanDoc).maybeSingle();
          if (existingUser && existingUser.id) {
            await supabase.from('usuarios').update({
              nome_completo: affiliate.fullName,
              whatsapp: affiliate.whatsapp
            }).eq('id', existingUser.id);
          } else {
            await supabase.from('usuarios').insert({
              id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
              nome_completo: affiliate.fullName,
              cpf: cleanDoc,
              whatsapp: affiliate.whatsapp,
              data_cadastro: affiliate.createdAt
            });
          }
        } catch (uErr) {
          console.warn('Erro ao sincronizar afiliado na tabela usuarios:', uErr);
        }

        // 4. Salva link em 'afiliados_links'
        try {
          const linkUid = randomUUID();
          await supabase.from('afiliados_links').upsert({
            id: linkUid,
            affiliate_id: affiliate.id,
            affiliate_code: affiliate.exclusiveCode
          }, { onConflict: 'affiliate_id' });
        } catch (lErr) {
          console.warn('Erro ao inserir afiliados_links:', lErr);
        }
      } catch (err) {
        console.error('Erro ao sincronizar afiliado com Supabase:', err);
      }
    }

    return { success: true, affiliate };
  }

  /**
   * Retorna lista de afiliados cadastrados (Supabase com fallback Local)
   */
  static async getAffiliates(): Promise<Affiliate[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error } = await supabase
          .from('afiliados')
          .select('*')
          .order('created_at', { ascending: false });

        if (error && error.code === '42703') {
          // Se a coluna created_at não existir no Supabase, consulta sem ordenação
          const fallback = await supabase.from('afiliados').select('*');
          data = fallback.data;
          error = fallback.error;
        }

        // Carrega também metadados detalhados de 'mensagens' se existirem
        const metaMap = new Map<string, any>();
        try {
          const { data: metaRows } = await supabase
            .from('mensagens')
            .select('conteudo')
            .eq('tipo', 'afiliado_perfil');

          if (metaRows) {
            metaRows.forEach(r => {
              try {
                if (r.conteudo) {
                  const parsed = JSON.parse(r.conteudo);
                  if (parsed && (parsed.id || parsed.exclusiveCode || parsed.email)) {
                    if (parsed.id) metaMap.set(parsed.id, parsed);
                    if (parsed.exclusiveCode) metaMap.set(parsed.exclusiveCode.toUpperCase(), parsed);
                    if (parsed.email) metaMap.set(parsed.email.toLowerCase(), parsed);
                    if (parsed.documentNumber) metaMap.set(parsed.documentNumber.replace(/\D/g, ''), parsed);
                  }
                }
              } catch {}
            });
          }
        } catch {}

        if (!error && data && data.length > 0) {
          const localDb = readLocalDb();
          const allCommissions = await this.getCommissions('all');

          return data
            .filter((row: any) => row.status !== 'cancelado')
            .map((row: any) => {
              const parsed = DatabaseService.parseAffiliateStatus(row.status);
              const meta = metaMap.get(row.id) ||
                metaMap.get((row.exclusive_code || '').toUpperCase()) ||
                metaMap.get((row.email || '').toLowerCase()) ||
                metaMap.get((row.document_number || '').replace(/\D/g, ''));

              const localAff = (localDb.afiliados || []).find(a =>
                a.id === row.id ||
                a.email.toLowerCase() === (row.email || '').toLowerCase() ||
                (row.document_number && a.documentNumber.replace(/\D/g, '') === row.document_number)
              );

              const affCode = (row.exclusive_code || meta?.exclusiveCode || localAff?.exclusiveCode || '').toUpperCase();
              const affId = (row.id || meta?.id || localAff?.id || '').toUpperCase();
              const affComms = allCommissions.filter(c =>
                (c.affiliateId && c.affiliateId.toUpperCase() === affId) ||
                (c.affiliateCode && c.affiliateCode.toUpperCase() === affCode)
              );

              const dynamicPending = affComms
                .filter(c => c.status === 'pendente' || c.status === 'aprovada' || c.status === 'em_analise')
                .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
              const dynamicAvailable = affComms
                .filter(c => c.status === 'disponivel')
                .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
              const dynamicPaid = affComms
                .filter(c => c.status === 'pago')
                .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
              const dynamicConversions = affComms.filter(c => c.status !== 'cancelado' && c.status !== 'cancelada').length;

              const finalPending = Math.max(Number(row.balance_pending ?? meta?.balancePending ?? localAff?.balancePending ?? 0), Number(dynamicPending.toFixed(2)));
              const finalAvailable = Math.max(Number(row.balance_available ?? meta?.balanceAvailable ?? localAff?.balanceAvailable ?? 0), Number(dynamicAvailable.toFixed(2)));
              const finalPaid = Math.max(Number(row.balance_paid ?? meta?.balancePaid ?? localAff?.balancePaid ?? 0), Number(dynamicPaid.toFixed(2)));
              const finalConversions = Math.max(Number(row.total_conversions ?? meta?.totalConversions ?? localAff?.totalConversions ?? 0), dynamicConversions);

              const resolvedParentCode = row.parent_affiliate_code || parsed.parentAffiliateCode || meta?.parentAffiliateCode || localAff?.parentAffiliateCode || undefined;
              const resolvedParentId = row.parent_affiliate_id || parsed.parentAffiliateId || meta?.parentAffiliateId || localAff?.parentAffiliateId || undefined;
              const resolvedParentName = row.parent_affiliate_name || parsed.parentAffiliateName || meta?.parentAffiliateName || localAff?.parentAffiliateName || undefined;

              const resolvedRate = Number(
                row.commission_rate ??
                parsed.commissionRate ??
                meta?.commissionRate ??
                localAff?.commissionRate ??
                (resolvedParentCode ? 0.10 : 0.15)
              );

              return {
                id: row.id,
                fullName: row.full_name || row.fullName || meta?.fullName || localAff?.fullName || row.email.split('@')[0],
                email: row.email,
                password: row.password || parsed.password || meta?.password || localAff?.password || '',
                documentType: row.document_type || localAff?.documentType || 'CPF',
                documentNumber: row.document_number || row.documentNumber || meta?.documentNumber || localAff?.documentNumber || '',
                phone: row.phone || meta?.phone || localAff?.phone || '',
                whatsapp: row.whatsapp || meta?.whatsapp || localAff?.whatsapp || '',
                birthDate: row.birth_date || meta?.birthDate || localAff?.birthDate,
                city: row.city || meta?.city || localAff?.city || '',
                state: row.state || meta?.state || localAff?.state || '',
                exclusiveCode: affCode || 'LUCK-7777',
                status: parsed.status || (row.status as any) || 'aprovado',
                rejectionReason: row.rejection_reason || meta?.rejectionReason || localAff?.rejectionReason,
                commissionRate: resolvedRate,
                pixKeyType: row.pix_key_type || localAff?.pixKeyType || 'CPF',
                pixKey: row.pix_key || meta?.pixKey || localAff?.pixKey || row.document_number,
                socialChannels: row.social_channels || meta?.socialChannels || localAff?.socialChannels || '',
                promotionStrategy: row.promotion_strategy || meta?.promotionStrategy || localAff?.promotionStrategy || (resolvedParentCode ? `Indicado pelo Afiliado ${resolvedParentCode}` : ''),
                balanceAvailable: finalAvailable,
                balancePending: finalPending,
                balancePaid: finalPaid,
                totalClicks: Number(row.total_clicks ?? meta?.totalClicks ?? localAff?.totalClicks ?? 0),
                totalConversions: finalConversions,
                termsAcceptedAt: row.terms_accepted_at || meta?.termsAcceptedAt || localAff?.termsAcceptedAt || new Date().toISOString(),
                privacyAcceptedAt: row.privacy_accepted_at || meta?.privacyAcceptedAt || localAff?.privacyAcceptedAt || new Date().toISOString(),
                createdAt: row.created_at || meta?.createdAt || localAff?.createdAt || new Date().toISOString(),
                approvedAt: row.approved_at || meta?.approvedAt || localAff?.approvedAt || new Date().toISOString(),
                approvedBy: row.approved_by || meta?.approvedBy || localAff?.approvedBy,
                parentAffiliateId: resolvedParentId,
                parentAffiliateCode: resolvedParentCode,
                parentAffiliateName: resolvedParentName
              };
            });
        }
      } catch (err) {
        console.warn('Erro ao consultar afiliados no Supabase:', err);
      }
    }

    const localDb = readLocalDb();
    const allCommissions = await this.getCommissions('all');
    return (localDb.afiliados || []).map(aff => {
      const affCode = (aff.exclusiveCode || '').toUpperCase();
      const affId = (aff.id || '').toUpperCase();
      const affComms = allCommissions.filter(c =>
        (c.affiliateId && c.affiliateId.toUpperCase() === affId) ||
        (c.affiliateCode && c.affiliateCode.toUpperCase() === affCode)
      );
      const dynamicPending = affComms
        .filter(c => c.status === 'pendente' || c.status === 'aprovada' || c.status === 'em_analise')
        .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
      const dynamicAvailable = affComms
        .filter(c => c.status === 'disponivel')
        .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
      const dynamicPaid = affComms
        .filter(c => c.status === 'pago')
        .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
      const dynamicConversions = affComms.filter(c => c.status !== 'cancelado' && c.status !== 'cancelada').length;

      return {
        ...aff,
        balancePending: Math.max(aff.balancePending || 0, Number(dynamicPending.toFixed(2))),
        balanceAvailable: Math.max(aff.balanceAvailable || 0, Number(dynamicAvailable.toFixed(2))),
        balancePaid: Math.max(aff.balancePaid || 0, Number(dynamicPaid.toFixed(2))),
        totalConversions: Math.max(aff.totalConversions || 0, dynamicConversions)
      };
    });
  }

  /**
   * Busca afiliado por ID, E-mail, CPF/CNPJ ou Código Exclusivo
   */
  static async getAffiliateByIdOrDoc(identifier: string): Promise<Affiliate | null> {
    const clean = identifier.trim().toLowerCase();
    const cleanDoc = identifier.replace(/\D/g, '');
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier.trim());

    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase.from('afiliados').select('*');
        if (cleanDoc.length >= 11) {
          query = query.or(`document_number.eq.${cleanDoc},document_number.eq.${identifier.trim()},email.ilike.${clean},exclusive_code.eq.${identifier.trim().toUpperCase()}`);
        } else if (isUuid) {
          query = query.or(`id.eq.${identifier.trim()},email.ilike.${clean},exclusive_code.eq.${identifier.trim().toUpperCase()}`);
        } else {
          query = query.or(`email.ilike.${clean},exclusive_code.eq.${identifier.trim().toUpperCase()},document_number.eq.${cleanDoc || clean}`);
        }

        const { data, error } = await query.limit(1);
        if (!error && data && data.length > 0) {
          const row = data[0];
          const parsed = DatabaseService.parseAffiliateStatus(row.status);

          // Busca perfil salvo em mensagens para resgatar dados complementares
          let meta: any = null;
          try {
            const { data: metaRow } = await supabase
              .from('mensagens')
              .select('conteudo')
              .eq('tipo', 'afiliado_perfil')
              .or(`id.eq.aff_meta_${row.id},destinatario_id.eq.${row.id}`)
              .limit(1)
              .maybeSingle();
            if (metaRow && metaRow.conteudo) {
              meta = JSON.parse(metaRow.conteudo);
            }
          } catch {}

          // Busca dados complementares em 'usuarios' caso faltem na tabela base
          let resolvedName = row.full_name || row.fullName || meta?.fullName || '';
          let resolvedPhone = row.phone || meta?.phone || '';
          let resolvedWhatsapp = row.whatsapp || meta?.whatsapp || '';

          const docNumber = row.document_number || row.documentNumber || meta?.documentNumber || cleanDoc;
          if (docNumber) {
            try {
              const { data: userRow } = await supabase
                .from('usuarios')
                .select('*')
                .eq('cpf', docNumber)
                .maybeSingle();
              if (userRow) {
                if (!resolvedName) resolvedName = userRow.nome_completo || '';
                if (!resolvedWhatsapp) resolvedWhatsapp = userRow.whatsapp || '';
                if (!resolvedPhone) resolvedPhone = userRow.whatsapp || '';
              }
            } catch {}
          }

          // Complementa com o banco local se existir
          const localDb = readLocalDb();
          const localAff = (localDb.afiliados || []).find(a =>
            a.id === row.id ||
            a.email.toLowerCase() === row.email.toLowerCase() ||
            (docNumber && a.documentNumber.replace(/\D/g, '') === docNumber)
          );

          // Calcula comissões dinâmicas do afiliado para garantir que nunca fiquem zeradas
          const allCommissions = await this.getCommissions('all');
          const affCode = (row.exclusive_code || meta?.exclusiveCode || localAff?.exclusiveCode || clean).toUpperCase();
          const affId = (row.id || meta?.id || localAff?.id || identifier).toUpperCase();
          const affComms = allCommissions.filter(c =>
            (c.affiliateId && c.affiliateId.toUpperCase() === affId) ||
            (c.affiliateCode && c.affiliateCode.toUpperCase() === affCode)
          );

          const dynamicPending = affComms
            .filter(c => c.status === 'pendente' || c.status === 'aprovada' || c.status === 'em_analise')
            .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
          const dynamicAvailable = affComms
            .filter(c => c.status === 'disponivel')
            .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
          const dynamicPaid = affComms
            .filter(c => c.status === 'pago')
            .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
          const dynamicConversions = affComms.filter(c => c.status !== 'cancelado' && c.status !== 'cancelada').length;

          const finalPending = Math.max(Number(localAff?.balancePending ?? meta?.balancePending ?? row.balance_pending ?? 0), Number(dynamicPending.toFixed(2)));
          const finalAvailable = Math.max(Number(localAff?.balanceAvailable ?? meta?.balanceAvailable ?? row.balance_available ?? 0), Number(dynamicAvailable.toFixed(2)));
          const finalPaid = Math.max(Number(localAff?.balancePaid ?? meta?.balancePaid ?? row.balance_paid ?? 0), Number(dynamicPaid.toFixed(2)));
          const finalConversions = Math.max(Number(localAff?.totalConversions ?? meta?.totalConversions ?? row.total_conversions ?? 0), dynamicConversions);

          const resolvedParentCode = row.parent_affiliate_code || parsed.parentAffiliateCode || meta?.parentAffiliateCode || localAff?.parentAffiliateCode || undefined;
          const resolvedParentId = row.parent_affiliate_id || parsed.parentAffiliateId || meta?.parentAffiliateId || localAff?.parentAffiliateId || undefined;
          const resolvedParentName = row.parent_affiliate_name || parsed.parentAffiliateName || meta?.parentAffiliateName || localAff?.parentAffiliateName || undefined;

          const resolvedRate = Number(
            row.commission_rate ??
            parsed.commissionRate ??
            meta?.commissionRate ??
            localAff?.commissionRate ??
            (resolvedParentCode ? 0.10 : 0.15)
          );

          const resolvedAff: Affiliate = {
            id: row.id,
            fullName: resolvedName || localAff?.fullName || row.email.split('@')[0],
            email: row.email,
            password: row.password || parsed.password || meta?.password || localAff?.password || '',
            documentType: row.document_type || localAff?.documentType || 'CPF',
            documentNumber: docNumber,
            phone: resolvedPhone || localAff?.phone || '',
            whatsapp: resolvedWhatsapp || localAff?.whatsapp || '',
            birthDate: row.birth_date || localAff?.birthDate,
            city: row.city || localAff?.city || '',
            state: row.state || localAff?.state || '',
            exclusiveCode: affCode,
            status: parsed.status || (row.status as any) || 'aprovado',
            rejectionReason: row.rejection_reason || meta?.rejectionReason || localAff?.rejectionReason,
            commissionRate: resolvedRate,
            pixKeyType: row.pix_key_type || localAff?.pixKeyType || 'CPF',
            pixKey: row.pix_key || meta?.pixKey || localAff?.pixKey || docNumber,
            socialChannels: row.social_channels || meta?.socialChannels || localAff?.socialChannels || '',
            promotionStrategy: row.promotion_strategy || meta?.promotionStrategy || localAff?.promotionStrategy || (resolvedParentCode ? `Indicado pelo Afiliado ${resolvedParentCode}` : ''),
            balanceAvailable: finalAvailable,
            balancePending: finalPending,
            balancePaid: finalPaid,
            totalClicks: Number(localAff?.totalClicks ?? meta?.totalClicks ?? row.total_clicks ?? 0),
            totalConversions: finalConversions,
            termsAcceptedAt: row.terms_accepted_at || meta?.termsAcceptedAt || localAff?.termsAcceptedAt || new Date().toISOString(),
            privacyAcceptedAt: row.privacy_accepted_at || meta?.privacyAcceptedAt || localAff?.privacyAcceptedAt || new Date().toISOString(),
            createdAt: row.created_at || meta?.createdAt || localAff?.createdAt || new Date().toISOString(),
            approvedAt: row.approved_at || meta?.approvedAt || localAff?.approvedAt || new Date().toISOString(),
            approvedBy: row.approved_by || meta?.approvedBy || localAff?.approvedBy,
            parentAffiliateId: resolvedParentId,
            parentAffiliateCode: resolvedParentCode,
            parentAffiliateName: resolvedParentName
          };

          if (!localAff) {
            localDb.afiliados.unshift(resolvedAff);
            writeLocalDb(localDb);
          }

          return resolvedAff;
        }
      } catch (err) {
        console.warn('Erro ao buscar afiliado no Supabase:', err);
      }
    }

    const localDb = readLocalDb();
    const aff = (localDb.afiliados || []).find(a =>
      a.id === identifier ||
      a.email.trim().toLowerCase() === clean ||
      a.documentNumber.replace(/\D/g, '') === cleanDoc ||
      a.exclusiveCode.toUpperCase() === clean.toUpperCase()
    );
    if (!aff) return null;

    const allCommissions = await this.getCommissions('all');
    const affCode = (aff.exclusiveCode || '').toUpperCase();
    const affId = (aff.id || '').toUpperCase();
    const affComms = allCommissions.filter(c =>
      (c.affiliateId && c.affiliateId.toUpperCase() === affId) ||
      (c.affiliateCode && c.affiliateCode.toUpperCase() === affCode)
    );
    const dynamicPending = affComms
      .filter(c => c.status === 'pendente' || c.status === 'aprovada' || c.status === 'em_analise')
      .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
    const dynamicAvailable = affComms
      .filter(c => c.status === 'disponivel')
      .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
    const dynamicPaid = affComms
      .filter(c => c.status === 'pago')
      .reduce((acc, c) => acc + (c.commissionAmount || 0), 0);
    const dynamicConversions = affComms.filter(c => c.status !== 'cancelado' && c.status !== 'cancelada').length;

    return {
      ...aff,
      balancePending: Math.max(aff.balancePending || 0, Number(dynamicPending.toFixed(2))),
      balanceAvailable: Math.max(aff.balanceAvailable || 0, Number(dynamicAvailable.toFixed(2))),
      balancePaid: Math.max(aff.balancePaid || 0, Number(dynamicPaid.toFixed(2))),
      totalConversions: Math.max(aff.totalConversions || 0, dynamicConversions)
    };
  }

  /**
   * Atualiza status do afiliado (aprovação, recusa, suspensão)
   */
  static async updateAffiliateStatus(
    id: string,
    status: AffiliateStatus,
    rejectionReason?: string,
    approvedBy?: string
  ): Promise<{ success: boolean; error?: string }> {
    const localDb = readLocalDb();
    const cleanId = id.trim();
    const nowIso = new Date().toISOString();

    // Atualiza no banco local
    const idx = (localDb.afiliados || []).findIndex(a =>
      a.id === cleanId ||
      a.email.toLowerCase() === cleanId.toLowerCase() ||
      a.exclusiveCode.toUpperCase() === cleanId.toUpperCase()
    );

    if (idx !== -1) {
      localDb.afiliados[idx].status = status;
      if (status === 'aprovado') {
        localDb.afiliados[idx].approvedAt = nowIso;
        localDb.afiliados[idx].approvedBy = approvedBy || 'admin';
        localDb.afiliados[idx].rejectionReason = undefined;
      } else if (status === 'recusado' || status === 'suspenso') {
        localDb.afiliados[idx].rejectionReason = rejectionReason;
      }
      writeLocalDb(localDb);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
        let query = supabase.from('afiliados').select('*');
        if (isUuid) {
          query = query.eq('id', cleanId);
        } else {
          query = query.or(`exclusive_code.eq.${cleanId.toUpperCase()},email.ilike.${cleanId}`);
        }

        const { data: rows, error: selectErr } = await query.limit(1);

        if (!selectErr && rows && rows.length > 0) {
          const current = rows[0];
          let pwd = '';
          if (typeof current.status === 'string' && current.status.includes('#pwd:')) {
            pwd = current.status.split('#pwd:')[1];
          }
          const statusValue = pwd ? `${status}#pwd:${pwd}` : status;

          // 1. Tenta atualizar com as colunas completas
          const fullUpdateData: any = { status };
          if (status === 'aprovado') {
            fullUpdateData.approved_at = nowIso;
            fullUpdateData.approved_by = approvedBy || 'admin';
            fullUpdateData.rejection_reason = null;
          } else if (status === 'recusado' || status === 'suspenso') {
            fullUpdateData.rejection_reason = rejectionReason || null;
          }

          const fullRes = await supabase.from('afiliados').update(fullUpdateData).eq('id', current.id);
          if (fullRes.error) {
            console.warn('Atualização com colunas de auditoria falhou no Supabase, gravando status base:', fullRes.error.message);
            // 2. Fallback caso colunas approved_at/rejection_reason não existam no Supabase
            const baseRes = await supabase.from('afiliados').update({ status: statusValue }).eq('id', current.id);
            if (baseRes.error) {
              console.error('Erro ao atualizar status base no Supabase:', baseRes.error);
              return { success: false, error: baseRes.error.message };
            }
          }
        } else {
          console.warn(`Afiliado ${cleanId} não localizado no Supabase para atualização de status.`);
        }
      } catch (err: any) {
        console.error('Erro ao atualizar status do afiliado no Supabase:', err);
        return { success: false, error: err.message || 'Erro interno no banco de dados.' };
      }
    }

    return { success: true };
  }

  /**
   * Atualiza a taxa de comissão de um afiliado (ex: 0.15 para 15%, 0.20 para 20%)
   */
  static async updateAffiliateCommissionRate(
    id: string,
    newRate: number
  ): Promise<{ success: boolean; error?: string }> {
    const localDb = readLocalDb();
    const cleanId = id.trim();
    const validatedRate = Math.min(Math.max(Number(newRate), 0.01), 0.90);

    // 1. Atualiza no banco local
    const idx = (localDb.afiliados || []).findIndex(a =>
      a.id === cleanId ||
      a.email.toLowerCase() === cleanId.toLowerCase() ||
      a.exclusiveCode.toUpperCase() === cleanId.toUpperCase()
    );

    if (idx !== -1) {
      localDb.afiliados[idx].commissionRate = validatedRate;
      writeLocalDb(localDb);
    }

    // 2. Atualiza no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cleanId);
        let query = supabase.from('afiliados').select('*');
        if (isUuid) {
          query = query.eq('id', cleanId);
        } else {
          query = query.or(`id.eq.${cleanId},exclusive_code.eq.${cleanId.toUpperCase()},email.ilike.${cleanId}`);
        }

        const { data: rows, error: selectErr } = await query.limit(1);

        if (!selectErr && rows && rows.length > 0) {
          const current = rows[0];
          const parsed = DatabaseService.parseAffiliateStatus(current.status);
          parsed.commissionRate = validatedRate;
          const newEncodedStatus = DatabaseService.encodeAffiliateStatus({
            status: parsed.status,
            password: parsed.password,
            parentAffiliateCode: parsed.parentAffiliateCode,
            parentAffiliateId: parsed.parentAffiliateId,
            parentAffiliateName: parsed.parentAffiliateName,
            commissionRate: validatedRate
          });

          // Tenta atualizar coluna commission_rate e status codificado
          const updateRes = await supabase
            .from('afiliados')
            .update({ commission_rate: validatedRate, status: newEncodedStatus })
            .eq('id', current.id);

          if (updateRes.error) {
            // Se a coluna commission_rate não existir no schema, grava pelo status codificado
            await supabase
              .from('afiliados')
              .update({ status: newEncodedStatus })
              .eq('id', current.id);
          }

          // Atualiza também mensagem de perfil para persistência permanente
          try {
            await supabase.from('mensagens').upsert({
              id: `aff_meta_${current.id}`,
              destinatario_id: current.id,
              telefone: (current.document_number || '').replace(/\D/g, '') || '00000000000',
              tipo: 'afiliado_perfil',
              conteudo: JSON.stringify({
                id: current.id,
                exclusiveCode: current.exclusive_code,
                email: current.email,
                commissionRate: validatedRate,
                parentAffiliateCode: parsed.parentAffiliateCode,
                parentAffiliateId: parsed.parentAffiliateId,
                parentAffiliateName: parsed.parentAffiliateName,
                password: parsed.password,
                status: parsed.status
              }),
              status: parsed.status,
              data_envio: new Date().toISOString()
            });
          } catch {}
        }
      } catch (err: any) {
        console.error('Erro ao salvar nova taxa de comissão no Supabase:', err);
        return { success: false, error: err.message || 'Erro interno no banco de dados.' };
      }
    }

    return { success: true };
  }

  /**
   * Registra a venda atribuída ao afiliado, calcula comissão com divisão automática de rede e atualiza saldos
   */
  static async recordAffiliateSale(params: {
    affiliateCode: string;
    orderAmount: number;
    ticketsCount: number;
    tickets: string[];
    buyerName: string;
    buyerCpf: string;
    campaign?: string;
    paymentId?: string;
  }): Promise<{ success: boolean; commission?: Commission; message?: string }> {
    const cleanAffCode = params.affiliateCode.trim().toUpperCase();
    const aff = await this.getAffiliateByIdOrDoc(cleanAffCode);

    if (!aff) {
      console.warn(`[Afiliados] Código ${cleanAffCode} não encontrado no banco de dados.`);
      return { success: false, message: 'Afiliado não encontrado.' };
    }

    if (aff.status === 'suspenso' || aff.status === 'recusado') {
      console.warn(`[Afiliados] Afiliado ${cleanAffCode} inativo ou suspenso (status: ${aff.status}).`);
      return { success: false, message: 'Afiliado inativo ou suspenso.' };
    }

    const localDb = readLocalDb();
    if (!localDb.comissoes) localDb.comissoes = [];

    // Deduplicação: se já existe comissão para este pagamento/conversão, não duplica
    if (params.paymentId) {
      const existingComm = localDb.comissoes.find(c =>
        c.conversionId === `conv_${params.paymentId}` ||
        c.conversionId === params.paymentId ||
        c.id === `comm_${params.paymentId}` ||
        c.id === params.paymentId
      );
      if (existingComm) {
        console.log(`[Afiliados] Comissão para o pagamento ${params.paymentId} já computada anteriormente. Retornando existente.`);
        return { success: true, commission: existingComm };
      }
    }

    // Taxa do afiliado vendedor: se for sub-afiliado tem a taxa destinada a ele (ex: 10%), se for direto recebe seus 100% (ex: 15%)
    const sellerRate = aff.commissionRate !== undefined && aff.commissionRate !== null
      ? aff.commissionRate
      : (aff.parentAffiliateCode ? 0.10 : 0.15);

    const sellerCommissionValue = Number((params.orderAmount * sellerRate).toFixed(2));
    const buyerFirstName = (params.buyerName || '').trim().split(' ')[0] || 'Cliente';

    // 1. Comissão direta do afiliado vendedor
    const directCommission: Commission = {
      id: params.paymentId ? `comm_${params.paymentId}` : `comm_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      conversionId: params.paymentId ? `conv_${params.paymentId}` : `conv_${Date.now()}`,
      affiliateId: aff.id,
      affiliateCode: aff.exclusiveCode,
      affiliateName: aff.fullName,
      orderAmount: params.orderAmount,
      commissionRate: sellerRate,
      commissionAmount: sellerCommissionValue,
      campaign: params.campaign || 'padrao',
      status: 'pendente',
      buyerName: params.buyerName,
      buyerFirstName,
      buyerCpf: params.buyerCpf,
      ticketsCount: params.ticketsCount,
      tickets: params.tickets,
      createdAt: new Date().toISOString()
    };

    localDb.comissoes.unshift(directCommission);

    // Garante presença do afiliado vendedor e atualiza saldo
    if (!localDb.afiliados) localDb.afiliados = [];
    const affIdx = localDb.afiliados.findIndex(a =>
      a.id === aff.id ||
      a.exclusiveCode.toUpperCase() === aff.exclusiveCode.toUpperCase()
    );

    if (affIdx !== -1) {
      localDb.afiliados[affIdx].balancePending = Number(((localDb.afiliados[affIdx].balancePending || 0) + sellerCommissionValue).toFixed(2));
      localDb.afiliados[affIdx].totalConversions = (localDb.afiliados[affIdx].totalConversions || 0) + 1;
    } else {
      const fullAff = { ...aff };
      fullAff.balancePending = Number(((fullAff.balancePending || 0) + sellerCommissionValue).toFixed(2));
      fullAff.totalConversions = (fullAff.totalConversions || 0) + 1;
      localDb.afiliados.unshift(fullAff);
    }

    // Atualiza estatísticas do link
    if (!localDb.afiliados_links) localDb.afiliados_links = [];
    const linkIdx = localDb.afiliados_links.findIndex(l =>
      l.affiliateId === aff.id || l.affiliateCode.toUpperCase() === aff.exclusiveCode.toUpperCase()
    );
    if (linkIdx !== -1) {
      localDb.afiliados_links[linkIdx].conversionsCount = (localDb.afiliados_links[linkIdx].conversionsCount || 0) + 1;
      localDb.afiliados_links[linkIdx].revenueGenerated = Number(((localDb.afiliados_links[linkIdx].revenueGenerated || 0) + params.orderAmount).toFixed(2));
    }

    // Persistência em Nuvem (Supabase): salva comissão direta em 'mensagens' com tipo 'comissao'
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('mensagens').upsert({
          id: directCommission.id,
          destinatario_id: aff.id,
          telefone: (params.buyerCpf || '00000000000').replace(/\D/g, ''),
          tipo: 'comissao',
          conteudo: JSON.stringify(directCommission),
          status: directCommission.status,
          data_envio: directCommission.createdAt
        });
      } catch (sbErr) {
        console.warn('Erro ao salvar comissão no Supabase mensagens:', sbErr);
      }
    }

    console.log(`[Afiliados] Comissão direta de R$ ${sellerCommissionValue.toFixed(2)} (${(sellerRate * 100).toFixed(0)}%) atribuída com sucesso a ${aff.fullName} (${aff.exclusiveCode})`);

    // 2. DIVISÃO AUTOMÁTICA DE COMISSÃO MULTINÍVEL (Afiliados e Sub-afiliados em cascata)
    if (aff.parentAffiliateCode || aff.parentAffiliateId) {
      try {
        let currentChild = aff;
        let currentChildRate = sellerRate;
        let uplineDepth = 0;
        const maxUplineDepth = 5;
        const visitedUplineIds = new Set<string>([aff.id, aff.exclusiveCode.toUpperCase()]);

        while ((currentChild.parentAffiliateCode || currentChild.parentAffiliateId) && uplineDepth < maxUplineDepth) {
          uplineDepth++;
          const parentCodeOrId = (currentChild.parentAffiliateCode || currentChild.parentAffiliateId || '').trim();
          const parentAff = await this.getAffiliateByIdOrDoc(parentCodeOrId);

          if (!parentAff || visitedUplineIds.has(parentAff.id) || visitedUplineIds.has(parentAff.exclusiveCode.toUpperCase())) {
            break;
          }
          visitedUplineIds.add(parentAff.id);
          visitedUplineIds.add(parentAff.exclusiveCode.toUpperCase());

          const parentBaseRate = parentAff.commissionRate !== undefined && parentAff.commissionRate !== null
            ? parentAff.commissionRate
            : 0.15;

          // Margem residual deste nível (diferença entre a taxa dele e a taxa do nível imediatamente abaixo)
          const overrideRate = Number(Math.max(0, parentBaseRate - currentChildRate).toFixed(4));
          const overrideValue = Number((params.orderAmount * overrideRate).toFixed(2));

          if (overrideValue > 0) {
            const overrideCommission: Commission = {
              id: params.paymentId
                ? `comm_ovr_${params.paymentId}_${parentAff.id.substring(0, 5)}_lvl${uplineDepth}`
                : `comm_ovr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}_lvl${uplineDepth}`,
              conversionId: params.paymentId ? `conv_${params.paymentId}` : `conv_${Date.now()}`,
              affiliateId: parentAff.id,
              affiliateCode: parentAff.exclusiveCode,
              affiliateName: parentAff.fullName,
              orderAmount: params.orderAmount,
              commissionRate: overrideRate,
              commissionAmount: overrideValue,
              campaign: `rede_${aff.exclusiveCode}`,
              status: 'pendente',
              buyerName: params.buyerName,
              buyerFirstName,
              buyerCpf: params.buyerCpf,
              ticketsCount: params.ticketsCount,
              tickets: params.tickets,
              isOverride: true,
              subAffiliateCode: aff.exclusiveCode,
              subAffiliateName: aff.fullName,
              createdAt: new Date().toISOString()
            };

            localDb.comissoes.unshift(overrideCommission);

            // Atualiza saldo pendente e conversões do patrocinador deste nível
            const parentIdx = localDb.afiliados.findIndex(a =>
              a.id === parentAff.id ||
              a.exclusiveCode.toUpperCase() === parentAff.exclusiveCode.toUpperCase()
            );

            if (parentIdx !== -1) {
              localDb.afiliados[parentIdx].balancePending = Number(((localDb.afiliados[parentIdx].balancePending || 0) + overrideValue).toFixed(2));
              localDb.afiliados[parentIdx].totalConversions = (localDb.afiliados[parentIdx].totalConversions || 0) + 1;
            } else {
              const fullParent = { ...parentAff };
              fullParent.balancePending = Number(((fullParent.balancePending || 0) + overrideValue).toFixed(2));
              fullParent.totalConversions = (fullParent.totalConversions || 0) + 1;
              localDb.afiliados.unshift(fullParent);
            }

            // Persiste comissão residual do patrocinador no Supabase
            if (isSupabaseConfigured && supabase) {
              try {
                await supabase.from('mensagens').upsert({
                  id: overrideCommission.id,
                  destinatario_id: parentAff.id,
                  telefone: (params.buyerCpf || '00000000000').replace(/\D/g, ''),
                  tipo: 'comissao',
                  conteudo: JSON.stringify(overrideCommission),
                  status: overrideCommission.status,
                  data_envio: overrideCommission.createdAt
                });
              } catch (pSbErr) {
                console.warn('Erro ao salvar comissão residual no Supabase:', pSbErr);
              }
            }

            console.log(`[Afiliados] Divisão automática nível ${uplineDepth}: comissão residual de R$ ${overrideValue.toFixed(2)} (${(overrideRate * 100).toFixed(0)}%) creditada a ${parentAff.fullName} (${parentAff.exclusiveCode})`);
          }

          currentChildRate = parentBaseRate;
          currentChild = parentAff;
        }
      } catch (parentErr) {
        console.error('Erro ao processar divisão automática de comissão multinível:', parentErr);
      }
    }

    writeLocalDb(localDb);

    return {
      success: true,
      commission: directCommission,
      message: `Comissão de R$ ${sellerCommissionValue.toFixed(2)} atribuída com sucesso ao afiliado ${aff.fullName} (${aff.exclusiveCode})!`
    };
  }

  /**
   * Registra clique do link de afiliado
   */
  static async recordAffiliateClick(affiliateCode: string, campaign?: string): Promise<{ success: boolean; totalClicks?: number }> {
    const clean = affiliateCode.trim().toUpperCase();
    const aff = await this.getAffiliateByIdOrDoc(clean);
    if (!aff) return { success: false };

    const localDb = readLocalDb();
    if (!localDb.afiliados) localDb.afiliados = [];
    const affIdx = localDb.afiliados.findIndex(a =>
      a.id === aff.id ||
      a.exclusiveCode.toUpperCase() === aff.exclusiveCode.toUpperCase()
    );

    let currentClicks = (aff.totalClicks || 0) + 1;
    if (affIdx !== -1) {
      localDb.afiliados[affIdx].totalClicks = (localDb.afiliados[affIdx].totalClicks || 0) + 1;
      currentClicks = localDb.afiliados[affIdx].totalClicks;
    } else {
      const fullAff = { ...aff, totalClicks: currentClicks };
      localDb.afiliados.unshift(fullAff);
    }

    if (localDb.afiliados_links) {
      const lIdx = localDb.afiliados_links.findIndex(l =>
        l.affiliateId === aff.id || l.affiliateCode.toUpperCase() === aff.exclusiveCode.toUpperCase()
      );
      if (lIdx !== -1) {
        localDb.afiliados_links[lIdx].clicksCount = (localDb.afiliados_links[lIdx].clicksCount || 0) + 1;
      }
    }

    writeLocalDb(localDb);
    return { success: true, totalClicks: currentClicks };
  }

  /**
   * Retorna comissões cadastradas no banco de dados (Supabase + Local)
   */
  static async getCommissions(affiliateIdOrCode?: string): Promise<Commission[]> {
    const localDb = readLocalDb();
    const mapById = new Map<string, Commission>();

    // 1. Carrega primeiro as comissões do banco local
    (localDb.comissoes || []).forEach(c => {
      if (c && c.id) mapById.set(c.id, c);
    });

    // 2. Consulta comissões persistidas no Supabase (garante dados em ambientes serverless)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: sbRows, error: sbErr } = await supabase
          .from('mensagens')
          .select('conteudo')
          .eq('tipo', 'comissao');

        if (!sbErr && sbRows && sbRows.length > 0) {
          for (const row of sbRows) {
            try {
              if (row.conteudo) {
                const comm: Commission = JSON.parse(row.conteudo);
                if (comm && comm.id) {
                  mapById.set(comm.id, comm);
                }
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar comissões do Supabase:', err);
      }
    }

    const list = Array.from(mapById.values());

    if (!affiliateIdOrCode || affiliateIdOrCode === 'all') {
      return list;
    }

    const clean = affiliateIdOrCode.trim().toUpperCase();
    let aff = (localDb.afiliados || []).find(a =>
      a.id.toUpperCase() === clean ||
      a.exclusiveCode.toUpperCase() === clean ||
      (a.email && a.email.toUpperCase() === clean)
    );

    if (!aff) {
      try {
        aff = (await this.getAffiliateByIdOrDoc(clean)) || undefined;
      } catch {}
    }

    const validIds = new Set<string>([clean]);
    if (aff) {
      if (aff.id) validIds.add(aff.id.toUpperCase());
      if (aff.exclusiveCode) validIds.add(aff.exclusiveCode.toUpperCase());
      if (aff.email) validIds.add(aff.email.toUpperCase());
    }

    return list.filter(c =>
      (c.affiliateId && validIds.has(c.affiliateId.toUpperCase())) ||
      (c.affiliateCode && validIds.has(c.affiliateCode.toUpperCase()))
    );
  }

  /**
   * Cria uma reserva temporária de bilhetes vinculada a uma cobrança Pix (válida por 15 min)
   * Garante que os números não sejam comprados ou reservados por outros participantes.
   */
  static async createTicketReservation(params: {
    paymentId: string;
    tickets: string[];
    amount: number;
    userName: string;
    userCpf: string;
    userWhatsapp: string;
    userEmail?: string;
    affiliateCode?: string;
    campaign?: string;
    expiresMinutes?: number;
  }): Promise<{ success: boolean; reservation?: TicketReservation; error?: string; conflictTickets?: string[] }> {
    const cleanCpf = (params.userCpf || '').replace(/\D/g, '');
    const cleanPhone = (params.userWhatsapp || '').replace(/\D/g, '');
    const cleanName = (params.userName || '').trim();
    const requestedTickets = [...new Set(params.tickets)];

    const localDb = readLocalDb();
    if (!localDb.reservas) localDb.reservas = [];

    const nowIso = new Date().toISOString();

    // 1. Limpa ou marca como expiradas as reservas que já venceram
    for (const r of localDb.reservas) {
      if (r.status === 'pending' && r.expiresAt <= nowIso) {
        r.status = 'expired';
      }
    }

    // 2. Verifica se algum bilhete já foi comprado no sorteio ativo
    const confirmedTickets = await this.getTickets();
    const soldSet = new Set(confirmedTickets.map(b => b.numero_milhar));
    const soldConflicts = requestedTickets.filter(n => soldSet.has(n));
    if (soldConflicts.length > 0) {
      return {
        success: false,
        error: `O(s) bilhete(s) ${soldConflicts.join(', ')} já foi(ram) adquirido(s). Por favor, escolha outros números.`,
        conflictTickets: soldConflicts
      };
    }

    // 3. Verifica se algum bilhete está em reserva pendente ativa por outro pagamento
    const activeReservations = localDb.reservas.filter(
      r => r.status === 'pending' && r.expiresAt > nowIso && r.paymentId !== params.paymentId
    );
    const reservedSet = new Set(activeReservations.flatMap(r => r.tickets));
    const reservedConflicts = requestedTickets.filter(n => reservedSet.has(n));
    if (reservedConflicts.length > 0) {
      return {
        success: false,
        error: `O(s) bilhete(s) ${reservedConflicts.join(', ')} já está(ão) reservado(s) aguardando pagamento Pix de outro participante.`,
        conflictTickets: reservedConflicts
      };
    }

    // 4. Cria ou atualiza a reserva
    const expiresAt = new Date(Date.now() + (params.expiresMinutes || 15) * 60 * 1000).toISOString();
    const newReservation: TicketReservation = {
      id: params.paymentId,
      paymentId: params.paymentId,
      tickets: requestedTickets,
      amount: params.amount,
      userName: cleanName || 'Participante da Sorte',
      userCpf: cleanCpf,
      userWhatsapp: cleanPhone,
      userEmail: params.userEmail,
      affiliateCode: params.affiliateCode,
      campaign: params.campaign,
      status: 'pending',
      createdAt: nowIso,
      expiresAt
    };

    // Remove reserva anterior com o mesmo paymentId se houver
    localDb.reservas = localDb.reservas.filter(r => r.paymentId !== params.paymentId && r.id !== params.paymentId);
    localDb.reservas.push(newReservation);
    writeLocalDb(localDb);

    // Opcional: tenta registrar no Supabase se houver tabela 'reservas' (sem quebrar se não houver)
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('reservas').upsert({
          id: newReservation.id,
          payment_id: newReservation.paymentId,
          tickets: newReservation.tickets,
          amount: newReservation.amount,
          user_name: newReservation.userName,
          user_cpf: newReservation.userCpf,
          user_whatsapp: newReservation.userWhatsapp,
          affiliate_code: newReservation.affiliateCode,
          campaign: newReservation.campaign,
          status: newReservation.status,
          created_at: newReservation.createdAt,
          expires_at: newReservation.expiresAt
        });
      } catch {
        // Ignora caso a tabela 'reservas' não exista no schema do Supabase
      }
    }

    // Salva também no Supabase (mensagens tipo 'reserva') para compartilhar entre containers serverless
    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('mensagens').upsert({
          id: `res_${newReservation.paymentId}`,
          telefone: cleanPhone || '00000000000',
          tipo: 'reserva',
          conteudo: JSON.stringify(newReservation),
          status: newReservation.status,
          data_envio: newReservation.createdAt
        });
      } catch (e) {
        console.warn('Erro ao salvar reserva no Supabase mensagens:', e);
      }
    }

    return { success: true, reservation: newReservation };
  }

  /**
   * Retorna os números das milhares atualmente em reserva ativa pendente (não expiradas)
   */
  static async getReservedTickets(): Promise<{ tickets: string[]; reservations: TicketReservation[] }> {
    const localDb = readLocalDb();
    if (!localDb.reservas) localDb.reservas = [];

    const nowIso = new Date().toISOString();
    let updated = false;

    // Atualiza status de expirados
    for (const r of localDb.reservas) {
      if (r.status === 'pending' && r.expiresAt <= nowIso) {
        r.status = 'expired';
        updated = true;
      }
    }

    if (updated) {
      writeLocalDb(localDb);
    }

    const activeReservations = localDb.reservas.filter(r => r.status === 'pending' && r.expiresAt > nowIso);
    const tickets = Array.from(new Set(activeReservations.flatMap(r => r.tickets)));

    return { tickets, reservations: activeReservations };
  }

  /**
   * Confirma e valida a reserva após o pagamento do Pix aprovado pelo Mercado Pago.
   * Cadastra os bilhetes oficialmente no nome do pagador e registra a comissão de afiliado.
   */
  static async confirmReservationByPaymentId(
    paymentId: string,
    mpPaymentData?: any
  ): Promise<{ success: boolean; tickets: Bilhete[]; user?: Usuario; alreadyConfirmed?: boolean; error?: string }> {
    const localDb = readLocalDb();
    if (!localDb.reservas) localDb.reservas = [];

    let reservation = localDb.reservas.find(r => r.paymentId === paymentId || r.id === paymentId);

    // Se não encontrou no banco local, tenta consultar no Supabase
    if (!reservation && isSupabaseConfigured && supabase) {
      try {
        const { data: resMsg } = await supabase
          .from('mensagens')
          .select('conteudo')
          .eq('id', `res_${paymentId}`)
          .maybeSingle();
        if (resMsg && resMsg.conteudo) {
          reservation = JSON.parse(resMsg.conteudo);
          if (reservation) {
            localDb.reservas.push(reservation);
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar reserva no Supabase mensagens:', err);
      }
    }

    // Se já foi aprovada anteriormente, não duplica
    if (reservation && reservation.status === 'approved') {
      const { user, tickets } = await this.getTicketsByCpf(reservation.userCpf);
      return { success: true, alreadyConfirmed: true, user: user || undefined, tickets };
    }

    // Se não encontrou no banco local, tenta reconstruir a partir dos metadados do Mercado Pago
    if (!reservation && mpPaymentData) {
      const meta = mpPaymentData.metadata || {};
      const payerObj = mpPaymentData.payer || {};
      const metaTickets: string[] = Array.isArray(meta.tickets)
        ? meta.tickets
        : typeof meta.tickets === 'string'
          ? meta.tickets.split(',').map((s: string) => s.trim())
          : [];

      const payerName = meta.payer_name || `${payerObj.first_name || ''} ${payerObj.last_name || ''}`.trim() || 'Participante Pix';
      const payerCpf = (meta.payer_cpf || payerObj.identification?.number || '').replace(/\D/g, '');
      const payerPhone = (meta.payer_whatsapp || payerObj.phone?.number || '').replace(/\D/g, '');

      if (metaTickets.length > 0) {
        reservation = {
          id: paymentId,
          paymentId: paymentId,
          tickets: metaTickets,
          amount: Number(mpPaymentData.transaction_amount) || metaTickets.length * 2.00,
          userName: payerName,
          userCpf: payerCpf,
          userWhatsapp: payerPhone,
          affiliateCode: meta.affiliate_code,
          campaign: meta.campaign,
          status: 'pending',
          createdAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 15 * 60 * 1000).toISOString()
        };
        localDb.reservas.push(reservation);
      }
    }

    if (!reservation) {
      return {
        success: false,
        tickets: [],
        error: `Nenhuma reserva ou metadados encontrados para o pagamento ${paymentId}`
      };
    }

    // Registra participante e seus bilhetes de forma definitiva (Supabase e local)
    const { user, newTickets } = await this.saveParticipant({
      nome_completo: reservation.userName,
      cpf: reservation.userCpf,
      whatsapp: reservation.userWhatsapp,
      tickets: reservation.tickets,
      paymentId: reservation.paymentId,
      affiliateCode: reservation.affiliateCode,
      campaign: reservation.campaign
    });

    // Atualiza status da reserva para aprovado no banco de dados mais atualizado (sem sobrescrever comissões)
    const freshDb = readLocalDb();
    if (!freshDb.reservas) freshDb.reservas = [];
    const resIdx = freshDb.reservas.findIndex(r => r.paymentId === paymentId || r.id === paymentId);
    if (resIdx !== -1) {
      freshDb.reservas[resIdx].status = 'approved';
    }
    writeLocalDb(freshDb);

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('reservas')
          .update({ status: 'approved' })
          .eq('payment_id', paymentId);
      } catch {
        // Ignora erro se tabela não existir
      }
    }

    console.log(`[PixConfirm] Pagamento ${paymentId} validado com sucesso! Usuário: ${user.nome_completo} (${user.cpf}), Bilhetes: ${reservation.tickets.join(', ')}`);

    return {
      success: true,
      tickets: newTickets,
      user
    };
  }

  private static lastAutoCheckTime = 0;

  /**
   * Varre reservas pendentes e auto-confirma com o Mercado Pago aquelas que foram pagas,
   * garantindo que nenhuma compra seja perdida mesmo se o usuário fechar o navegador.
   */
  static async checkAndAutoConfirmPendingReservations(): Promise<number> {
    const now = Date.now();
    // Throttle de 8 segundos para evitar sobrecarga de requisições externas ao Mercado Pago
    if (now - this.lastAutoCheckTime < 8000) {
      return 0;
    }
    this.lastAutoCheckTime = now;

    const localDb = readLocalDb();
    if (!localDb.reservas) localDb.reservas = [];

    const nowIso = new Date().toISOString();
    const pendings = localDb.reservas.filter(r => r.status === 'pending');
    if (pendings.length === 0) return 0;

    let confirmedCount = 0;

    for (const res of pendings) {
      try {
        // Se já venceu há mais de 10 minutos após o prazo de 15min, marca expirado
        if (new Date(res.expiresAt).getTime() < now - 10 * 60 * 1000) {
          res.status = 'expired';
          continue;
        }

        // Não consulta transações com menos de 3 segundos de criação
        if (now - new Date(res.createdAt).getTime() < 3000) {
          continue;
        }

        const mpStatus = await checkPaymentStatus(res.paymentId);
        if (mpStatus.status === 'approved') {
          await this.confirmReservationByPaymentId(res.paymentId, mpStatus.paymentData);
          confirmedCount++;
        } else if (res.expiresAt <= nowIso && mpStatus.status !== 'pending') {
          res.status = 'expired';
        }
      } catch (err) {
        console.warn(`[AutoConfirm] Erro ao verificar reserva ${res.paymentId}:`, err);
      }
    }

    const hasExpiredChanges = pendings.some(r => r.status === 'expired');
    if (hasExpiredChanges) {
      const freshDb = readLocalDb();
      if (!freshDb.reservas) freshDb.reservas = [];
      for (const res of pendings) {
        if (res.status === 'expired') {
          const idx = freshDb.reservas.findIndex(r => r.id === res.id || r.paymentId === res.paymentId);
          if (idx !== -1 && freshDb.reservas[idx].status === 'pending') {
            freshDb.reservas[idx].status = 'expired';
          }
        }
      }
      writeLocalDb(freshDb);
    }

    return confirmedCount;
  }

  /**
   * Retorna o ganhador programado ativo para o sorteio das 19h
   */
  static async getSorteadoProgramado(): Promise<SorteadoProgramado | null> {
    // 1. Consulta primeiro no Supabase tabela 'mensagens' (garante persistência multi-container na nuvem/Vercel)
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: row, error } = await supabase
          .from('mensagens')
          .select('conteudo, status')
          .eq('id', 'sorteado_programado_active')
          .maybeSingle();

        if (!error && row && row.conteudo) {
          if (row.status === 'ativo') {
            const parsed: SorteadoProgramado = JSON.parse(row.conteudo);
            if (parsed && parsed.ativo) {
              return parsed;
            }
          } else {
            // Explicitamente inativo ou cancelado no Supabase
            return null;
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar sorteado_programado em mensagens do Supabase:', err);
      }

      // Tenta também tabela 'sorteado_programado' caso tenha sido criada manualmente no Supabase
      try {
        const { data, error } = await supabase
          .from('sorteado_programado')
          .select('*')
          .eq('ativo', true)
          .order('criado_em', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!error && data) {
          return data as SorteadoProgramado;
        }
      } catch (e) {
        // Fallback
      }
    }

    // 2. Fallback para banco local
    const localDb = readLocalDb();
    if (localDb.sorteado_programado && localDb.sorteado_programado.ativo) {
      return localDb.sorteado_programado;
    }

    return null;
  }

  /**
   * Salva e programa o ganhador que sairá no sorteio das 19h.
   * Cadastra o participante e seu bilhete premiado de forma oficial e atômica.
   */
  static async saveSorteadoProgramado(data: {
    nome_completo: string;
    cpf: string;
    whatsapp: string;
    numero_milhar: string;
  }): Promise<SorteadoProgramado> {
    const cleanName = data.nome_completo.trim();
    const cleanCpf = data.cpf.replace(/\D/g, '');
    const cleanPhone = data.whatsapp.replace(/\D/g, '');
    const cleanMilhar = String(data.numero_milhar).replace(/\D/g, '').padStart(4, '0').slice(-4);

    const localDb = readLocalDb();

    // 1. Localiza ou cria o usuário oficial
    let user = localDb.usuarios.find(u => u.cpf.replace(/\D/g, '') === cleanCpf);
    if (!user) {
      user = {
        id: `usr_${cleanCpf || Date.now()}`,
        nome_completo: cleanName,
        cpf: cleanCpf,
        whatsapp: cleanPhone,
        data_cadastro: new Date().toISOString()
      };
      localDb.usuarios.push(user);
    } else {
      user.nome_completo = cleanName;
      user.whatsapp = cleanPhone;
    }

    // 2. Localiza ou cria o sorteio ativo oficial agendado (Supabase primeiro, fallback local)
    let drawId = '';
    if (isSupabaseConfigured && supabase) {
      try {
        const { data: activeDraws } = await supabase
          .from('sorteios')
          .select('id')
          .in('status', ['agendado', 'em_andamento'])
          .order('data_sorteio', { ascending: true })
          .limit(1);

        if (activeDraws && activeDraws.length > 0) {
          drawId = activeDraws[0].id;
        } else {
          // Cria novo sorteio agendado no Supabase
          const newId = `sorteio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
          const target19h = new Date();
          target19h.setHours(19, 0, 0, 0);
          if (Date.now() >= target19h.getTime()) {
            target19h.setDate(target19h.getDate() + 1);
          }
          await supabase.from('sorteios').insert([{
            id: newId,
            data_sorteio: target19h.toISOString(),
            numeros_sorteados: null,
            ganhador_id: null,
            premio: 500,
            acumulado: false,
            status: 'agendado',
            eh_domingo: target19h.getDay() === 0
          }]);
          drawId = newId;
        }
      } catch (err) {
        console.warn('Erro ao consultar/criar sorteio agendado no Supabase:', err);
      }
    }

    if (!drawId) {
      let activeDraw = localDb.sorteios.find(s => s.status === 'agendado' || s.status === 'em_andamento');
      if (!activeDraw) {
        const newDraw: Sorteio = {
          id: `sorteio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          data_sorteio: new Date(new Date().setHours(19, 0, 0, 0)).toISOString(),
          numeros_sorteados: null,
          ganhador_id: null,
          premio: 500,
          acumulado: false,
          status: 'agendado',
          eh_domingo: new Date().getDay() === 0
        };
        if (!localDb.sorteios) localDb.sorteios = [];
        localDb.sorteios.push(newDraw);
        activeDraw = newDraw;
      }
      drawId = activeDraw.id;
    }

    // 3. Garante que o bilhete desta milhar existe e pertence a este participante
    let ticket = (localDb.bilhetes || []).find(b => b.sorteio_id === drawId && b.numero_milhar === cleanMilhar);
    if (!ticket) {
      ticket = {
        id: `bilhete_prog_${cleanMilhar}`,
        numero_milhar: cleanMilhar,
        usuario_id: user.id,
        sorteio_id: drawId,
        data_compra: new Date().toISOString(),
        status_pagamento: true,
        valor: 2.00,
        usuario: user
      };
      if (!localDb.bilhetes) localDb.bilhetes = [];
      localDb.bilhetes.push(ticket);
    } else {
      ticket.usuario_id = user.id;
      ticket.usuario = user;
      ticket.status_pagamento = true;
    }

    // 4. Salva a programação oficial
    const sorteado: SorteadoProgramado = {
      id: `sorteado_${Date.now()}`,
      nome_completo: cleanName,
      cpf: cleanCpf,
      whatsapp: cleanPhone,
      numero_milhar: cleanMilhar,
      ativo: true,
      criado_em: new Date().toISOString(),
      utilizado_em: null
    };

    localDb.sorteado_programado = sorteado;
    writeLocalDb(localDb);

    // 5. Persiste no Supabase
    if (isSupabaseConfigured && supabase) {
      try {
        // Upsert participante
        await supabase.from('usuarios').upsert([
          {
            id: user.id,
            nome_completo: cleanName,
            cpf: cleanCpf,
            whatsapp: cleanPhone,
            data_cadastro: user.data_cadastro
          }
        ], { onConflict: 'id' });

        // Upsert bilhete premiado
        await supabase.from('bilhetes').upsert([
          {
            id: ticket.id,
            numero_milhar: cleanMilhar,
            usuario_id: user.id,
            sorteio_id: drawId,
            status_pagamento: true,
            valor: 2.00,
            data_compra: ticket.data_compra
          }
        ], { onConflict: 'id' });

        // Persiste programação oficial na tabela 'mensagens' (compatível 100% com schema do Supabase em Serverless)
        await supabase.from('mensagens').upsert({
          id: 'sorteado_programado_active',
          destinatario_id: user.id,
          telefone: cleanPhone || '00000000000',
          tipo: 'sorteado_programado',
          conteudo: JSON.stringify(sorteado),
          status: 'ativo',
          data_envio: sorteado.criado_em
        }, { onConflict: 'id' });

        // Opcional: tenta salvar na tabela sorteado_programado se existir
        try {
          await supabase.from('sorteado_programado').upsert([sorteado], { onConflict: 'id' });
        } catch {}
      } catch (err) {
        console.warn('Erro ao sincronizar sorteado_programado no Supabase:', err);
      }
    }

    return sorteado;
  }

  /**
   * Remove ou desativa a programação de ganhador
   */
  static async clearSorteadoProgramado(): Promise<void> {
    const localDb = readLocalDb();
    if (localDb.sorteado_programado) {
      localDb.sorteado_programado.ativo = false;
      writeLocalDb(localDb);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // Atualiza na tabela mensagens
        await supabase
          .from('mensagens')
          .update({
            status: 'inativo',
            conteudo: JSON.stringify({ ativo: false })
          })
          .eq('id', 'sorteado_programado_active');

        // Tenta também tabela sorteado_programado caso exista
        try {
          await supabase
            .from('sorteado_programado')
            .update({ ativo: false })
            .eq('ativo', true);
        } catch {}
      } catch (err) {
        console.warn('Erro ao desativar sorteado no Supabase:', err);
      }
    }
  }

  /**
   * Marca o sorteado programado como já utilizado após o sorteio ser concluído
   */
  static async markSorteadoAsUsed(drawId: string): Promise<void> {
    const localDb = readLocalDb();
    if (localDb.sorteado_programado) {
      localDb.sorteado_programado.ativo = false;
      localDb.sorteado_programado.utilizado_em = drawId;
      writeLocalDb(localDb);
    }

    if (isSupabaseConfigured && supabase) {
      try {
        const { data: row } = await supabase
          .from('mensagens')
          .select('conteudo')
          .eq('id', 'sorteado_programado_active')
          .maybeSingle();

        let updatedPayload: any = { ativo: false, utilizado_em: drawId };
        if (row?.conteudo) {
          try {
            const parsed = JSON.parse(row.conteudo);
            updatedPayload = { ...parsed, ativo: false, utilizado_em: drawId };
          } catch {}
        }

        await supabase
          .from('mensagens')
          .update({
            status: 'inativo',
            conteudo: JSON.stringify(updatedPayload)
          })
          .eq('id', 'sorteado_programado_active');

        try {
          await supabase
            .from('sorteado_programado')
            .update({ ativo: false, utilizado_em: drawId })
            .eq('ativo', true);
        } catch {}
      } catch (err) {
        console.warn('Erro ao atualizar sorteado_programado como utilizado no Supabase:', err);
      }
    }
  }
}

