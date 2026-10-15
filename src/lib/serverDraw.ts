import { supabase, isSupabaseConfigured } from './supabase';
import { Bilhete, Mensagem, Sorteio, Usuario } from '@/types';
import { getNextDrawSchedule, shouldShowLastDrawResult } from './drawTime';
import { WhatsAppTemplates, sendWhatsAppMessage } from './whatsapp';
import { DatabaseService } from './db';
import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'database.json');

function readLocalDbFallback() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
      if (!data.usuarios) data.usuarios = [];
      if (!data.bilhetes) data.bilhetes = [];
      if (!data.sorteios) data.sorteios = [];
      if (!data.mensagens) data.mensagens = [];
      if (!data.afiliados) data.afiliados = [];
      if (!data.afiliados_links) data.afiliados_links = [];
      if (!data.comissoes) data.comissoes = [];
      if (!data.reservas) data.reservas = [];
      return data;
    }
  } catch {}
  return { usuarios: [], bilhetes: [], sorteios: [], mensagens: [], afiliados: [], afiliados_links: [], comissoes: [], reservas: [] };
}

function writeLocalDbFallback(data: any) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch {}
}

/**
 * Gerador pseudo-aleatório determinístico baseado em seed (ID do sorteio + data).
 * Garante que QUALQUER servidor ou requisição concorrente produza RIGOROSAMENTE
 * o mesmo número e a mesma sequência de giros, eliminando divergência entre PC e celular.
 */
function createDeterministicRng(seedStr: string): () => number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 16777619);
  }
  return function() {
    h += h << 13;
    h ^= h >>> 7;
    h += h << 3;
    h ^= h >>> 17;
    h += h << 5;
    return (h >>> 0) / 4294967296;
  };
}

export interface DrawExecutionResult {
  sorteio: Sorteio;
  milhar: string;
  ganhador: Usuario | null;
  mensagensGeradas: Mensagem[];
  girosDomingo?: string[]; // Sequência idêntica dos 4 giros enviada para todos os aparelhos
}

export class ServerDrawService {
  /**
   * Mutex para requisições simultâneas concorrentes (evita race-condition entre celular e PC)
   */
  private static inFlightExecution: Promise<DrawExecutionResult> | null = null;

  /**
   * Cache de memória para sincronização instantânea em tempo real (últimos 60s)
   */
  private static lastExecution: {
    drawId: string;
    milhar: string;
    sorteio: Sorteio;
    ganhador: Usuario | null;
    mensagensGeradas: Mensagem[];
    girosDomingo?: string[];
    timestamp: number;
  } | null = null;

  /**
   * Inicia a Simulação da Semana Completa (7 Sorteios a cada 5 minutos):
   * - Etapas 1 a 6 (Segunda a Sábado): NÃO sai ganhador -> Prêmio acumula +R$ 500 por etapa até R$ 3.500.
   * - Etapa 7 (Domingo da Sorte): Roda 4 vezes na tela, sai ganhador garantido e libera o prêmio!
   * - Após a etapa 7: Encerra o teste e retorna automaticamente ao horário oficial normal (às 19:00h com R$ 500).
   */
  static async startWeekSimulation(firstStepDelayMinutes: number = 5): Promise<Sorteio> {
    this.lastExecution = null;

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('sorteios').delete().neq('id', 'keep_none');
        await supabase.from('bilhetes').delete().neq('id', 'none_preserve');
      } catch (e) {
        console.warn('Erro ao limpar sorteios anteriores:', e);
      }
    }

    const firstTarget = new Date(Date.now() + firstStepDelayMinutes * 60 * 1000);

    const step1Draw: Sorteio = {
      id: 'sorteio_simulacao_etapa_1',
      data_sorteio: firstTarget.toISOString(),
      numeros_sorteados: null,
      ganhador_id: null,
      premio: 500,
      acumulado: false,
      status: 'agendado',
      eh_domingo: false
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('sorteios').insert([step1Draw]);
      } catch (e) {
        console.warn('Erro ao inserir Etapa 1 no Supabase:', e);
      }
    }

    const local = readLocalDbFallback();
    local.bilhetes = [];
    local.sorteios = [step1Draw];
    writeLocalDbFallback(local);

    return step1Draw;
  }

  /**
   * Retorna o sorteio ativo agendado na nuvem (Supabase).
   * Se não existir nenhum agendado, inicializa o próximo automaticamente.
   */
  static async getCurrentOrScheduledDraw(): Promise<Sorteio> {
    const schedule = getNextDrawSchedule();

    // Se houve sorteio nos últimos 30 segundos, exibe ele para todos os clientes acompanharem a celebração
    if (this.lastExecution && (Date.now() - this.lastExecution.timestamp < 30000)) {
      return this.lastExecution.sorteio;
    }

    if (isSupabaseConfigured && supabase) {
      try {
        // 1. Busca sorteio agendado ou em andamento
        const { data: activeDraws, error } = await supabase
          .from('sorteios')
          .select('*')
          .in('status', ['agendado', 'em_andamento'])
          .order('data_sorteio', { ascending: true })
          .limit(1);

        if (!error && activeDraws && activeDraws.length > 0) {
          const row = activeDraws[0] as Sorteio;
          
          // Se o horário do sorteio agendado já passou há mais de 30 segundos, executa automaticamente
          const drawTime = new Date(row.data_sorteio).getTime();
          if (row.status === 'agendado' && Date.now() >= drawTime + 30000) {
            console.log(`[AutoDraw] Horário do sorteio ${row.id} atingido (${row.data_sorteio}). Executando sorteio oficial...`);
            const execResult = await this.executeOfficialDraw({ drawId: row.id });
            return execResult.sorteio;
          }

          if (row.ganhador_id) {
            const { data: user } = await supabase
              .from('usuarios')
              .select('*')
              .eq('id', row.ganhador_id)
              .maybeSingle();
            row.ganhador = user || null;
          }
          return row;
        }

        // 2. Se não encontrou ativo, verifica o último sorteio para saber se acumulou
        const { data: lastDraws } = await supabase
          .from('sorteios')
          .select('*')
          .order('data_sorteio', { ascending: false })
        /* PAUSADO TEMPORARIAMENTE: Prêmio acumulado pausado para retornar em breve
        let prize = 500;
        let isAcumulado = false;

        if (lastDraws && lastDraws.length > 0) {
          const last = lastDraws[0];
          if (last.acumulado) {
            prize = Number(last.premio) || 500;
            isAcumulado = true;
          }
        }
        */
        const prize = 500;
        const isAcumulado = false;

        // 3. Cria um novo sorteio agendado na nuvem (R$ 500 diário fixo)
        const newDrawId = `sorteio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        const newDrawRecord = {
          id: newDrawId,
          data_sorteio: schedule.targetIso,
          numeros_sorteados: null,
          ganhador_id: null,
          premio: 500,
          acumulado: false,
          status: 'agendado',
          eh_domingo: schedule.isSunday
        };

        const { data: inserted, error: insertErr } = await supabase
          .from('sorteios')
          .insert([newDrawRecord])
          .select()
          .single();

        if (!insertErr && inserted) {
          return inserted as Sorteio;
        }
      } catch (err) {
        console.warn('Erro ao consultar/criar sorteio no Supabase:', err);
      }
    }

    // Fallback local caso Supabase falhe temporariamente
    const local = readLocalDbFallback();
    let current = local.sorteios.find((s: Sorteio) => s.status === 'agendado' || s.status === 'em_andamento');
    if (!current) {
      current = {
        id: `sorteio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        data_sorteio: schedule.targetIso,
        numeros_sorteados: null,
        ganhador_id: null,
        premio: 500,
        acumulado: false,
        status: 'agendado',
        eh_domingo: schedule.isSunday
      };
      local.sorteios.push(current);
      writeLocalDbFallback(local);
    }
    return current;
  }

  /**
   * Retorna os bilhetes vendidos e confirmados para o sorteio atual (sem duplicatas)
   */
  static async getConfirmedTickets(drawId?: string): Promise<Bilhete[]> {
    if (isSupabaseConfigured && supabase) {
      try {
        let query = supabase
          .from('bilhetes')
          .select('*, usuario:usuarios(*)')
          .eq('status_pagamento', true);

        if (drawId) {
          query = query.eq('sorteio_id', drawId);
        }

        const { data, error } = await query;

        if (!error && data) {
          const map = new Map<string, Bilhete>();
          for (const b of data as Bilhete[]) {
            if (!map.has(b.numero_milhar)) {
              map.set(b.numero_milhar, b);
            }
          }
          return Array.from(map.values());
        }
      } catch (e) {
        console.warn('Erro ao buscar bilhetes confirmados:', e);
      }
    }

    const local = readLocalDbFallback();
    const map = new Map<string, Bilhete>();
    for (const b of (local.bilhetes || [])) {
      if (b.status_pagamento && (!drawId || b.sorteio_id === drawId)) {
        if (!map.has(b.numero_milhar)) {
          map.set(b.numero_milhar, b);
        }
      }
    }
    return Array.from(map.values());
  }

  /**
   * Executa o sorteio centralizado no Servidor de forma 100% ATÔMICA e IDEMPOTENTE.
   */
  static async executeOfficialDraw(options?: {
    drawId?: string;
    forcedWinnerMilhar?: string;
    isSunday?: boolean;
  }): Promise<DrawExecutionResult> {
    // 🔒 MUTEX CONCORRENTE: Se outra requisição (ex: PC) já estiver executando neste exato instante,
    // a requisição do Celular aguarda e recebe o MESMO resultado!
    if (this.inFlightExecution) {
      return await this.inFlightExecution;
    }

    this.inFlightExecution = this.runAtomicDraw(options);
    try {
      const result = await this.inFlightExecution;
      return result;
    } finally {
      this.inFlightExecution = null;
    }
  }

  private static async runAtomicDraw(options?: {
    drawId?: string;
    forcedWinnerMilhar?: string;
    isSunday?: boolean;
  }): Promise<DrawExecutionResult> {
    const now = Date.now();

    // 0. Consulta se há Ganhador Programado pelo Administrador
    const sorteadoProg = await DatabaseService.getSorteadoProgramado();
    const hasProgrammedWinner = Boolean(sorteadoProg && sorteadoProg.ativo);
    const targetProgrammedMilhar = hasProgrammedWinner
      ? String(sorteadoProg!.numero_milhar).replace(/\D/g, '').padStart(4, '0').slice(-4)
      : (options?.forcedWinnerMilhar ? String(options.forcedWinnerMilhar).replace(/\D/g, '').padStart(4, '0').slice(-4) : undefined);

    // 1. SINCRONIZAÇÃO EM TEMPO REAL:
    // Se houve sorteio executado nos últimos 60 segundos, todos os dispositivos recebem EXATAMENTE o mesmo!
    // (A menos que haja um ganhador programado ou forçado pendente com milhar diferente do cache)
    if (this.lastExecution && (now - this.lastExecution.timestamp < 60000)) {
      const matchMilhar = !targetProgrammedMilhar || this.lastExecution.milhar === targetProgrammedMilhar;
      if (matchMilhar && (!options?.drawId || options.drawId === this.lastExecution.drawId)) {
        return {
          sorteio: this.lastExecution.sorteio,
          milhar: this.lastExecution.milhar,
          ganhador: this.lastExecution.ganhador,
          mensagensGeradas: this.lastExecution.mensagensGeradas
        };
      } else if (!matchMilhar) {
        this.lastExecution = null;
      }
    }

    let targetDraw: Sorteio | null = null;

    // 2. Se um drawId específico foi passado, busca no Supabase
    if (options?.drawId && isSupabaseConfigured && supabase) {
      const { data: found } = await supabase
        .from('sorteios')
        .select('*')
        .eq('id', options.drawId)
        .maybeSingle();

      if (found) {
        targetDraw = found as Sorteio;
      }
    }

    // Se não havia sorteio específico, busca o ativo agendado
    if (!targetDraw) {
      targetDraw = await this.getCurrentOrScheduledDraw();
    }

    // 3. Se o sorteio com esse ID já estiver finalizado:
    // Se há ganhador programado e o sorteio finalizado tem milhar diferente, inicia um ciclo novo para premiar o número programado!
    if (targetDraw && targetDraw.status === 'finalizado' && targetDraw.numeros_sorteados) {
      if (targetProgrammedMilhar && targetDraw.numeros_sorteados !== targetProgrammedMilhar) {
        console.log(`[Draw] Sorteio ${targetDraw.id} finalizado com ${targetDraw.numeros_sorteados}. Criando novo sorteio para aplicar milhar programada ${targetProgrammedMilhar}...`);
        targetDraw = await this.startNewCycle();
      } else {
        let winner: Usuario | null = null;
        if (targetDraw.ganhador_id && isSupabaseConfigured && supabase) {
          const { data: u } = await supabase.from('usuarios').select('*').eq('id', targetDraw.ganhador_id).maybeSingle();
          winner = u || null;
        }
        return {
          sorteio: { ...targetDraw, ganhador: winner },
          milhar: targetDraw.numeros_sorteados,
          ganhador: winner,
          mensagensGeradas: []
        };
      }
    }

    // 4. Inicializa gerador determinístico baseado no ID e Data do Sorteio
    const rng = createDeterministicRng(`${targetDraw.id}_${targetDraw.data_sorteio}`);

    // Busca bilhetes vendidos confirmados
    const bilhetes = await this.getConfirmedTickets(targetDraw.id);
    const isSunday = options?.isSunday ?? targetDraw.eh_domingo ?? false;

    // Verifica se este sorteio faz parte da Simulação dos 7 dias
    const isSimulacao = targetDraw.id.startsWith('sorteio_simulacao_etapa_');
    const stepMatch = targetDraw.id.match(/sorteio_simulacao_etapa_(\d+)/);
    const stepNum = stepMatch ? parseInt(stepMatch[1], 10) : 0;

    let milharSorteado = '';
    let bilheteGanhador: Bilhete | undefined;
    let ganhadorUsuario: Usuario | null = null;
    let foiAcumulado = false;
    let novoPremio = 500;
    let girosDomingo: string[] | undefined = undefined;

    // =========================================================================
    // 👑 PRIORIDADE ABSOLUTA 1: GANHADOR PROGRAMADO PELO ADMINISTRADOR
    // "eu sempre vou escolher o ganhador" - garantido 100%
    // =========================================================================
    if (hasProgrammedWinner && sorteadoProg) {
      const targetMilhar = targetProgrammedMilhar!;
      milharSorteado = targetMilhar;

      const cleanName = sorteadoProg.nome_completo.trim();
      const cleanCpf = sorteadoProg.cpf.replace(/\D/g, '');
      const cleanPhone = sorteadoProg.whatsapp.replace(/\D/g, '');

      let winnerUser: Usuario | null = null;
      const localData = readLocalDbFallback();
      winnerUser = (localData.usuarios || []).find((u: Usuario) => u.cpf.replace(/\D/g, '') === cleanCpf) || null;

      if (!winnerUser && isSupabaseConfigured && supabase) {
        try {
          const { data: su } = await supabase.from('usuarios').select('*').eq('cpf', cleanCpf).maybeSingle();
          if (su) winnerUser = su as Usuario;
        } catch {}
      }

      if (!winnerUser) {
        winnerUser = {
          id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
          nome_completo: cleanName,
          cpf: cleanCpf,
          whatsapp: cleanPhone,
          data_cadastro: new Date().toISOString()
        };
        if (!localData.usuarios) localData.usuarios = [];
        localData.usuarios.push(winnerUser);
        writeLocalDbFallback(localData);

        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('usuarios').upsert([winnerUser], { onConflict: 'id' });
          } catch {}
        }
      } else {
        winnerUser.nome_completo = cleanName;
        winnerUser.whatsapp = cleanPhone;
        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('usuarios').upsert([winnerUser], { onConflict: 'id' });
          } catch {}
        }
      }

      // Localiza ou cria o bilhete premiado correspondente
      let winningTicket = bilhetes.find(b => b.numero_milhar === targetMilhar);
      if (!winningTicket) {
        winningTicket = {
          id: `bilhete_prog_${targetMilhar}`,
          numero_milhar: targetMilhar,
          usuario_id: winnerUser.id,
          sorteio_id: targetDraw.id,
          data_compra: new Date().toISOString(),
          status_pagamento: true,
          valor: 2.00,
          usuario: winnerUser
        };
        if (!localData.bilhetes) localData.bilhetes = [];
        localData.bilhetes.push(winningTicket);
        writeLocalDbFallback(localData);

        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('bilhetes').upsert([{
              id: winningTicket.id,
              numero_milhar: targetMilhar,
              usuario_id: winnerUser.id,
              sorteio_id: targetDraw.id,
              status_pagamento: true,
              valor: 2.00,
              data_compra: winningTicket.data_compra
            }], { onConflict: 'id' });
          } catch {}
        }
      } else {
        winningTicket.usuario_id = winnerUser.id;
        winningTicket.usuario = winnerUser;
        winningTicket.status_pagamento = true;

        if (isSupabaseConfigured && supabase) {
          try {
            await supabase.from('bilhetes').upsert([{
              id: winningTicket.id,
              numero_milhar: targetMilhar,
              usuario_id: winnerUser.id,
              sorteio_id: targetDraw.id,
              status_pagamento: true,
              valor: 2.00,
              data_compra: winningTicket.data_compra
            }], { onConflict: 'id' });
          } catch {}
        }
      }

      bilheteGanhador = winningTicket;
      ganhadorUsuario = winnerUser;
      foiAcumulado = false;
      novoPremio = 500;

      if (isSunday) {
        const soldNumbers = new Set(bilhetes.map(b => b.numero_milhar));
        soldNumbers.add(milharSorteado);
        const dummySpins: string[] = [];
        while (dummySpins.length < 3) {
          const dummy = String(Math.floor(rng() * 10000)).padStart(4, '0');
          if (!soldNumbers.has(dummy) && !dummySpins.includes(dummy)) {
            dummySpins.push(dummy);
          }
        }
        girosDomingo = [...dummySpins, milharSorteado];
      }
    } else if (targetProgrammedMilhar) {
      milharSorteado = targetProgrammedMilhar;
      bilheteGanhador = bilhetes.find(b => b.numero_milhar === milharSorteado);
      if (bilheteGanhador) {
        ganhadorUsuario = bilheteGanhador.usuario || null;
      }
      foiAcumulado = false;
      novoPremio = 500;
    } else if (isSimulacao && stepNum >= 1 && stepNum <= 6) {
      // 🌟 ETAPAS 1 A 6 (Segunda a Sábado): NÃO SAI GANHADOR! Acumula R$ 500 por etapa
      const soldSet = new Set(bilhetes.map(b => b.numero_milhar));
      let rand = String(Math.floor(rng() * 10000)).padStart(4, '0');
      while (soldSet.has(rand)) {
        rand = String(Math.floor(rng() * 10000)).padStart(4, '0');
      }

      milharSorteado = rand;
      bilheteGanhador = undefined;
      ganhadorUsuario = null;
      foiAcumulado = false;
      novoPremio = 500;

      // Zera bilhetes anteriores para a próxima rodada de vendas
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('bilhetes').delete().neq('id', 'none_preserve');
        } catch (e) {
          console.warn('Erro ao zerar bilhetes no Supabase:', e);
        }
      }
      const localSim = readLocalDbFallback();
      localSim.bilhetes = [];
      writeLocalDbFallback(localSim);

      // Agenda a próxima etapa para daqui a 5 minutos
      const nextStepTarget = new Date(Date.now() + 5 * 60 * 1000);
      const isNextSunday = (stepNum + 1 === 7);
      const nextStepRecord = {
        id: `sorteio_simulacao_etapa_${stepNum + 1}`,
        data_sorteio: nextStepTarget.toISOString(),
        numeros_sorteados: null,
        ganhador_id: null,
        premio: 500,
        acumulado: false,
        status: 'agendado',
        eh_domingo: isNextSunday
      };

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('sorteios').insert([nextStepRecord]);
        } catch (e) {
          console.warn('Erro ao agendar próxima etapa no Supabase:', e);
        }
      }
    } else if (isSimulacao && stepNum === 7) {
      // 🌟 ETAPA 7 (DOMINGO DA SORTE): SAI GANHADOR GARANTIDO E LIBERA O PRÊMIO!
      let winningTicket = bilhetes.length > 0 ? bilhetes[Math.floor(rng() * bilhetes.length)] : undefined;

      if (!winningTicket) {
        let candidateUser: Usuario | null = null;
        if (isSupabaseConfigured && supabase) {
          const { data: users } = await supabase.from('usuarios').select('*').limit(1);
          if (users && users.length > 0) {
            candidateUser = users[0] as Usuario;
          }
        }
        if (!candidateUser) {
          candidateUser = {
            id: 'usr_flavio_oficial',
            nome_completo: 'Flavio Participante Oficial',
            cpf: '01234567890',
            whatsapp: '11987654321',
            data_cadastro: new Date().toISOString()
          };
        }

        winningTicket = {
          id: 'bilhete_oficial_ganhador_domingo',
          numero_milhar: '7777',
          usuario_id: candidateUser.id,
          sorteio_id: targetDraw.id,
          data_compra: new Date().toISOString(),
          status_pagamento: true,
          valor: 2.00,
          usuario: candidateUser
        };
      }

      milharSorteado = winningTicket.numero_milhar;
      bilheteGanhador = winningTicket;
      ganhadorUsuario = winningTicket.usuario || null;
      foiAcumulado = false;
      novoPremio = 500;

      const soldNumbers = new Set(bilhetes.map(b => b.numero_milhar));
      soldNumbers.add(milharSorteado);
      const dummySpins: string[] = [];
      while (dummySpins.length < 3) {
        const dummy = String(Math.floor(rng() * 10000)).padStart(4, '0');
        if (!soldNumbers.has(dummy) && !dummySpins.includes(dummy)) {
          dummySpins.push(dummy);
        }
      }
      girosDomingo = [...dummySpins, milharSorteado];

      const normalSchedule = getNextDrawSchedule();
      const returnToNormalRecord = {
        id: 'sorteio_oficial_diario',
        data_sorteio: normalSchedule.targetIso,
        numeros_sorteados: null,
        ganhador_id: null,
        premio: 500,
        acumulado: false,
        status: 'agendado',
        eh_domingo: false
      };

      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('bilhetes').delete().neq('id', 'none_preserve');
          await supabase.from('sorteios').insert([returnToNormalRecord]);
        } catch (e) {
          console.warn('Erro ao retornar ao sorteio normal no Supabase:', e);
        }
      }
      const localSim7 = readLocalDbFallback();
      localSim7.bilhetes = [];
      writeLocalDbFallback(localSim7);
    } else {
      // =========================================================================
      // OPERAÇÃO PADRÃO DIÁRIA REGULAR (SEM GANHADOR PROGRAMADO)
      // "o ganhador eu que irei definir por esse painel, quando não for preenchido não havera ganhador"
      // =========================================================================
      if (options?.forcedWinnerMilhar) {
        milharSorteado = options.forcedWinnerMilhar;
        bilheteGanhador = bilhetes.find(b => b.numero_milhar === milharSorteado);
        if (bilheteGanhador) {
          foiAcumulado = false;
          novoPremio = 500;
          if (bilheteGanhador.usuario) {
            ganhadorUsuario = bilheteGanhador.usuario;
          } else if (bilheteGanhador.usuario_id && isSupabaseConfigured && supabase) {
            const { data: u } = await supabase.from('usuarios').select('*').eq('id', bilheteGanhador.usuario_id).maybeSingle();
            ganhadorUsuario = u || null;
          }
        } else {
          foiAcumulado = true;
          novoPremio = 500;
          ganhadorUsuario = null;
        }
      } else {
        // 🌟 REGRA ABSOLUTA DO ADMINISTRADOR:
        // "quando não for preenchido não havera ganhador"
        // Sorteia uma milhar que NÃO foi comprada por nenhum participante, garantindo 100% que NÃO HAVERÁ GANHADOR!
        const soldSet = new Set(bilhetes.map(b => b.numero_milhar));
        let rand = String(Math.floor(rng() * 10000)).padStart(4, '0');
        let attempts = 0;
        while (soldSet.has(rand) && attempts < 10000) {
          rand = String(Math.floor(rng() * 10000)).padStart(4, '0');
          attempts++;
        }

        milharSorteado = rand;
        bilheteGanhador = undefined;
        ganhadorUsuario = null;
        foiAcumulado = true;
        novoPremio = 500;

        if (isSunday) {
          const dummySpins: string[] = [];
          while (dummySpins.length < 3) {
            const dummy = String(Math.floor(rng() * 10000)).padStart(4, '0');
            if (dummy !== milharSorteado && !dummySpins.includes(dummy)) {
              dummySpins.push(dummy);
            }
          }
          girosDomingo = [...dummySpins, milharSorteado];
        }
      }

      // 🌟 REGRA DO CLIENTE:
      // Após o sorteio, os números voltam a ser vendidos novamente!
      // A nova rodada de vendas inicia imediatamente com todos os 10.000 números disponíveis.
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('bilhetes').delete().neq('id', 'none_preserve');
        } catch (e) {
          console.warn('Erro ao zerar bilhetes no Supabase para nova rodada:', e);
        }
      }
      const local = readLocalDbFallback();
      local.bilhetes = [];
      writeLocalDbFallback(local);

      // Agenda a próxima rodada oficial para amanhã às 19:00h (Prêmio R$ 500,00 diário fixo)
      const nextSchedule = getNextDrawSchedule(new Date(Date.now() + 60000));
      const nextId = `sorteio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      if (isSupabaseConfigured && supabase) {
        try {
          await supabase.from('sorteios').insert([
            {
              id: nextId,
              data_sorteio: nextSchedule.targetIso,
              numeros_sorteados: null,
              ganhador_id: null,
              premio: 500,
              acumulado: false,
              status: 'agendado',
              eh_domingo: nextSchedule.isSunday
            }
          ]);
        } catch (err) {
          console.warn('Erro ao atualizar sorteio no Supabase:', err);
        }
      }
    }

    // 8. Atualiza o sorteio atual no Supabase marcando como finalizado
    const finalizedDraw: Sorteio = {
      ...targetDraw,
      numeros_sorteados: milharSorteado,
      ganhador_id: ganhadorUsuario ? ganhadorUsuario.id : null,
      ganhador: ganhadorUsuario,
      status: 'finalizado',
      acumulado: foiAcumulado
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase
          .from('sorteios')
          .update({
            numeros_sorteados: milharSorteado,
            ganhador_id: ganhadorUsuario ? ganhadorUsuario.id : null,
            status: 'finalizado',
            acumulado: foiAcumulado
          })
          .eq('id', targetDraw.id);
      } catch (err) {
        console.warn('Erro ao finalizar sorteio no Supabase:', err);
      }
    }

    // Atualiza fallback local
    const local = readLocalDbFallback();
    const idx = local.sorteios.findIndex((s: Sorteio) => s.id === targetDraw.id);
    if (idx >= 0) {
      local.sorteios[idx] = finalizedDraw;
    } else {
      local.sorteios.push(finalizedDraw);
    }
    writeLocalDbFallback(local);

    // Marca o sorteado programado como utilizado se houver
    if (hasProgrammedWinner) {
      try {
        await DatabaseService.markSorteadoAsUsed(targetDraw.id);
      } catch (e) {
        console.warn('Erro ao marcar sorteado como utilizado:', e);
      }
    }

    // 9. Mensagens de Notificação via WhatsApp para o Ganhador
    const mensagensGeradas: Mensagem[] = [];
    try {
      if (ganhadorUsuario) {
        const winMsg = await sendWhatsAppMessage({
          toPhone: ganhadorUsuario.whatsapp,
          recipientName: ganhadorUsuario.nome_completo,
          userId: ganhadorUsuario.id,
          content: WhatsAppTemplates.parabenizacaoGanhador({
            nomeCompleto: ganhadorUsuario.nome_completo,
            milhar: milharSorteado,
            premio: targetDraw.premio
          }),
          type: 'parabenizacao'
        });
        mensagensGeradas.push(winMsg);
      }
    } catch (e) {
      console.warn('Erro ao registrar mensagem WhatsApp:', e);
    }

    // Armazena no cache de sincronização instantânea
    this.lastExecution = {
      drawId: targetDraw.id,
      milhar: milharSorteado,
      sorteio: finalizedDraw,
      ganhador: ganhadorUsuario,
      mensagensGeradas,
      girosDomingo,
      timestamp: Date.now()
    };

    return {
      sorteio: finalizedDraw,
      milhar: milharSorteado,
      ganhador: ganhadorUsuario,
      mensagensGeradas,
      girosDomingo
    };
  }

  /**
   * Retorna o último sorteio finalizado para exibição pública na página inicial,
   * respeitando a regra do cliente de apagar os dados toda Segunda-feira às 10h da manhã.
   */
  static async getLastFinishedDraw(): Promise<{
    drawId: string;
    dataSorteio: string;
    milhar: string;
    premio: number;
    acumulou: boolean;
    ganhadorPrimeiroNome?: string;
    ganhadorTelefoneFinal?: string;
    isVisible: boolean;
  } | null> {
    let lastDraw: Sorteio | null = null;

    if (isSupabaseConfigured && supabase) {
      try {
        let { data, error } = await supabase
          .from('sorteios')
          .select('*, ganhador:usuarios(*)')
          .eq('status', 'finalizado')
          .not('numeros_sorteados', 'is', null)
          .order('data_sorteio', { ascending: false })
          .limit(1);

        if (error) {
          const fallback = await supabase
            .from('sorteios')
            .select('*')
            .eq('status', 'finalizado')
            .not('numeros_sorteados', 'is', null)
            .order('data_sorteio', { ascending: false })
            .limit(1);
          data = fallback.data;
        }

        if (data && data.length > 0) {
          lastDraw = data[0] as Sorteio;
        }
      } catch (e) {
        console.warn('Erro ao buscar último sorteio no Supabase:', e);
      }
    }

    if (!lastDraw) {
      const local = readLocalDbFallback();
      const finished = (local.sorteios || [])
        .filter((s: Sorteio) => s.status === 'finalizado' && s.numeros_sorteados)
        .sort((a: Sorteio, b: Sorteio) => new Date(b.data_sorteio).getTime() - new Date(a.data_sorteio).getTime());
      if (finished.length > 0) {
        lastDraw = finished[0];
      }
    }

    if (!lastDraw || !lastDraw.numeros_sorteados) {
      return null;
    }

    let primeiroNome = '';
    let telefoneFinal = '';

    if (lastDraw.ganhador) {
      primeiroNome = lastDraw.ganhador.nome_completo.trim().split(' ')[0];
      const digits = (lastDraw.ganhador.whatsapp || '').replace(/\D/g, '');
      telefoneFinal = digits.slice(-4);
    } else if (lastDraw.ganhador_id) {
      if (isSupabaseConfigured && supabase) {
        try {
          const { data: u } = await supabase.from('usuarios').select('*').eq('id', lastDraw.ganhador_id).maybeSingle();
          if (u) {
            primeiroNome = u.nome_completo.trim().split(' ')[0];
            const digits = (u.whatsapp || '').replace(/\D/g, '');
            telefoneFinal = digits.slice(-4);
          }
        } catch {}
      }
      if (!primeiroNome) {
        try {
          const local = readLocalDbFallback();
          const u = (local.usuarios || []).find((usr: Usuario) => usr.id === lastDraw.ganhador_id);
          if (u) {
            primeiroNome = u.nome_completo.trim().split(' ')[0];
            const digits = (u.whatsapp || '').replace(/\D/g, '');
            telefoneFinal = digits.slice(-4);
          }
        } catch {}
      }
    }

    return {
      drawId: lastDraw.id,
      dataSorteio: lastDraw.data_sorteio,
      milhar: lastDraw.numeros_sorteados,
      premio: lastDraw.premio,
      acumulou: lastDraw.acumulado,
      ganhadorPrimeiroNome: primeiroNome || undefined,
      ganhadorTelefoneFinal: telefoneFinal || undefined,
      isVisible: true
    };
  }

  /**
   * Reseta manualmente o ciclo e inicia um novo sorteio
   */
  static async startNewCycle(): Promise<Sorteio> {
    this.lastExecution = null;
    const schedule = getNextDrawSchedule(new Date(Date.now() + 60000));
    const nextId = `sorteio_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newDraw: Sorteio = {
      id: nextId,
      data_sorteio: schedule.targetIso,
      numeros_sorteados: null,
      ganhador_id: null,
      premio: 500,
      acumulado: false,
      status: 'agendado',
      eh_domingo: schedule.isSunday
    };

    if (isSupabaseConfigured && supabase) {
      try {
        await supabase.from('bilhetes').delete().neq('id', 'none_preserve');
        await supabase.from('sorteios').delete().neq('id', 'keep_none');
        await supabase.from('sorteios').insert([newDraw]);
      } catch (e) {
        console.warn('Erro ao iniciar novo ciclo no Supabase:', e);
      }
    }

    const local = readLocalDbFallback();
    local.bilhetes = [];
    local.sorteios = [newDraw];
    writeLocalDbFallback(local);

    return newDraw;
  }
}
