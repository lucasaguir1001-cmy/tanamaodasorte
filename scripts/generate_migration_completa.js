const fs = require('fs');

const backup = JSON.parse(fs.readFileSync('supabase_backup.json', 'utf8'));

function escapeSql(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return val;
  if (typeof val === 'boolean') return val ? 'TRUE' : 'FALSE';
  if (typeof val === 'object') {
    return "'" + JSON.stringify(val).replace(/'/g, "''") + "'";
  }
  return "'" + String(val).replace(/'/g, "''") + "'";
}

let sql = `-- ========================================================
-- MIGRACAO COMPLETA TÁ NA MÃO DA SORTE - NOVO SUPABASE
-- Este script:
-- 1. Remove tabelas anteriores com tipagem incompatível (UUID)
-- 2. Cria as tabelas com tipos universais (ID TEXT)
-- 3. Habilita RLS e permissões públicas de leitura/escrita
-- 4. Importa AUTOMATICAMENTE TODOS os 46 clientes, afiliados, sorteios e bilhetes
-- ========================================================

-- 1. LIMPEZA PREVIA
DROP TABLE IF EXISTS public.afiliados_links CASCADE;
DROP TABLE IF EXISTS public.afiliados CASCADE;
DROP TABLE IF EXISTS public.bilhetes CASCADE;
DROP TABLE IF EXISTS public.mensagens CASCADE;
DROP TABLE IF EXISTS public.sorteios CASCADE;
DROP TABLE IF EXISTS public.usuarios CASCADE;

-- 2. CRIACAO DAS TABELAS COM ID TEXTO

-- Tabela usuarios
CREATE TABLE public.usuarios (
    id TEXT PRIMARY KEY,
    nome_completo TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    whatsapp TEXT NOT NULL,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela sorteios
CREATE TABLE public.sorteios (
    id TEXT PRIMARY KEY,
    data_sorteio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    numeros_sorteados TEXT,
    ganhador_id TEXT,
    premio NUMERIC(10, 2) DEFAULT 500.00 NOT NULL,
    acumulado BOOLEAN DEFAULT FALSE NOT NULL,
    status TEXT DEFAULT 'agendado',
    eh_domingo BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Tabela bilhetes
CREATE TABLE public.bilhetes (
    id TEXT PRIMARY KEY,
    numero_milhar VARCHAR(4) NOT NULL,
    usuario_id TEXT NOT NULL,
    sorteio_id TEXT,
    data_compra TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status_pagamento BOOLEAN DEFAULT FALSE NOT NULL,
    payment_id TEXT,
    valor NUMERIC(10, 2) DEFAULT 2.00 NOT NULL
);

-- Tabela mensagens
CREATE TABLE public.mensagens (
    id TEXT PRIMARY KEY,
    usuario_id TEXT,
    destinatario_id TEXT,
    telefone TEXT,
    conteudo TEXT NOT NULL,
    tipo TEXT NOT NULL,
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status TEXT DEFAULT 'enviado'
);

-- Tabela afiliados (com suporte a multinivel e sub-afiliados)
CREATE TABLE public.afiliados (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT,
    document_type TEXT NOT NULL DEFAULT 'CPF',
    document_number TEXT UNIQUE NOT NULL,
    phone TEXT NOT NULL,
    whatsapp TEXT NOT NULL,
    birth_date TEXT,
    city TEXT NOT NULL,
    state TEXT NOT NULL,
    exclusive_code TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL DEFAULT 'pendente',
    rejection_reason TEXT,
    commission_rate NUMERIC(5, 4) NOT NULL DEFAULT 0.15,
    pix_key_type TEXT NOT NULL DEFAULT 'CPF',
    pix_key TEXT NOT NULL,
    social_channels TEXT,
    promotion_strategy TEXT,
    balance_available NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_pending NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_clicks INTEGER NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    parent_affiliate_id TEXT,
    parent_affiliate_code TEXT,
    parent_affiliate_name TEXT,
    terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    privacy_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT
);

-- Tabela afiliados_links
CREATE TABLE public.afiliados_links (
    id TEXT PRIMARY KEY,
    affiliate_id TEXT NOT NULL,
    affiliate_code TEXT NOT NULL,
    destination_path TEXT NOT NULL DEFAULT '/',
    campaign_name TEXT NOT NULL DEFAULT 'padrao',
    full_url TEXT NOT NULL,
    clicks_count INTEGER NOT NULL DEFAULT 0,
    conversions_count INTEGER NOT NULL DEFAULT 0,
    revenue_generated NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. HABILITAR SEGURANCA E PERMISSOES (RLS)
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sorteios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bilhetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliados_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Public insert usuarios" ON public.usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update usuarios" ON public.usuarios FOR UPDATE USING (true);

CREATE POLICY "Public read sorteios" ON public.sorteios FOR SELECT USING (true);
CREATE POLICY "Public insert sorteios" ON public.sorteios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update sorteios" ON public.sorteios FOR UPDATE USING (true);

CREATE POLICY "Public read bilhetes" ON public.bilhetes FOR SELECT USING (true);
CREATE POLICY "Public insert bilhetes" ON public.bilhetes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update bilhetes" ON public.bilhetes FOR UPDATE USING (true);

CREATE POLICY "Public read mensagens" ON public.mensagens FOR SELECT USING (true);
CREATE POLICY "Public insert mensagens" ON public.mensagens FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update mensagens" ON public.mensagens FOR UPDATE USING (true);

CREATE POLICY "Public read afiliados" ON public.afiliados FOR SELECT USING (true);
CREATE POLICY "Public insert afiliados" ON public.afiliados FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update afiliados" ON public.afiliados FOR UPDATE USING (true);

CREATE POLICY "Public read afiliados_links" ON public.afiliados_links FOR SELECT USING (true);
CREATE POLICY "Public insert afiliados_links" ON public.afiliados_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update afiliados_links" ON public.afiliados_links FOR UPDATE USING (true);

-- 4. INSERCAO DE TODOS OS DADOS DO SISTEMA ANTIGO

`;

// 1. Usuarios
if (backup.usuarios && backup.usuarios.length > 0) {
  sql += `-- Inserindo ${backup.usuarios.length} Usuarios\n`;
  for (const u of backup.usuarios) {
    sql += `INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES (${escapeSql(u.id)}, ${escapeSql(u.nome_completo)}, ${escapeSql(u.cpf)}, ${escapeSql(u.whatsapp)}, ${escapeSql(u.data_cadastro)}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 2. Sorteios
if (backup.sorteios && backup.sorteios.length > 0) {
  sql += `-- Inserindo ${backup.sorteios.length} Sorteios\n`;
  for (const s of backup.sorteios) {
    sql += `INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES (${escapeSql(s.id)}, ${escapeSql(s.data_sorteio)}, ${escapeSql(s.numeros_sorteados)}, ${escapeSql(s.ganhador_id)}, ${escapeSql(s.premio || 500)}, ${escapeSql(s.acumulado || false)}, ${escapeSql(s.status || 'agendado')}, ${escapeSql(s.eh_domingo || false)}, ${escapeSql(s.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 3. Bilhetes
if (backup.bilhetes && backup.bilhetes.length > 0) {
  sql += `-- Inserindo ${backup.bilhetes.length} Bilhetes\n`;
  for (const b of backup.bilhetes) {
    sql += `INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES (${escapeSql(b.id)}, ${escapeSql(b.numero_milhar)}, ${escapeSql(b.usuario_id)}, ${escapeSql(b.sorteio_id)}, ${escapeSql(b.data_compra)}, ${escapeSql(b.status_pagamento)}, ${escapeSql(b.payment_id)}, ${escapeSql(b.valor || 2.00)}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 4. Afiliados
if (backup.afiliados && backup.afiliados.length > 0) {
  sql += `-- Inserindo ${backup.afiliados.length} Afiliados\n`;
  for (const a of backup.afiliados) {
    sql += `INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES (${escapeSql(a.id)}, ${escapeSql(a.full_name || a.email)}, ${escapeSql(a.email)}, ${escapeSql(a.password || '')}, ${escapeSql(a.document_type || 'CPF')}, ${escapeSql(a.document_number)}, ${escapeSql(a.phone || a.whatsapp || '')}, ${escapeSql(a.whatsapp || '')}, ${escapeSql(a.birth_date)}, ${escapeSql(a.city || 'Brasil')}, ${escapeSql(a.state || 'SP')}, ${escapeSql(a.exclusive_code)}, ${escapeSql(a.status || 'pendente')}, ${escapeSql(a.rejection_reason)}, ${escapeSql(a.commission_rate || 0.15)}, ${escapeSql(a.pix_key_type || 'CPF')}, ${escapeSql(a.pix_key || a.document_number)}, ${escapeSql(a.social_channels || '')}, ${escapeSql(a.promotion_strategy || '')}, ${escapeSql(a.balance_available || 0)}, ${escapeSql(a.balance_pending || 0)}, ${escapeSql(a.balance_paid || 0)}, ${escapeSql(a.total_clicks || 0)}, ${escapeSql(a.total_conversions || 0)}, ${escapeSql(a.terms_accepted_at || new Date().toISOString())}, ${escapeSql(a.privacy_accepted_at || new Date().toISOString())}, ${escapeSql(a.created_at || new Date().toISOString())}, ${escapeSql(a.approved_at)}, ${escapeSql(a.approved_by)}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 5. Afiliados Links
if (backup.afiliados_links && backup.afiliados_links.length > 0) {
  sql += `-- Inserindo ${backup.afiliados_links.length} Links de Afiliados\n`;
  for (const l of backup.afiliados_links) {
    sql += `INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES (${escapeSql(l.id)}, ${escapeSql(l.affiliate_id)}, ${escapeSql(l.affiliate_code)}, ${escapeSql(l.destination_path || '/')}, ${escapeSql(l.campaign_name || 'padrao')}, ${escapeSql(l.full_url || 'https://tanamaodasorte.com.br/?afiliado=' + l.affiliate_code)}, ${escapeSql(l.clicks_count || 0)}, ${escapeSql(l.conversions_count || 0)}, ${escapeSql(l.revenue_generated || 0)}, ${escapeSql(l.is_active !== false)}, ${escapeSql(l.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 6. Mensagens
if (backup.mensagens && backup.mensagens.length > 0) {
  sql += `-- Inserindo ${backup.mensagens.length} Mensagens / Comissoes\n`;
  for (const m of backup.mensagens) {
    sql += `INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES (${escapeSql(m.id)}, ${escapeSql(m.usuario_id)}, ${escapeSql(m.destinatario_id)}, ${escapeSql(m.telefone)}, ${escapeSql(m.conteudo)}, ${escapeSql(m.tipo || 'lembrete')}, ${escapeSql(m.data_envio || new Date().toISOString())}, ${escapeSql(m.status || 'enviado')}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

fs.writeFileSync('supabase/migration_completa_supabase.sql', sql, 'utf8');
console.log('Script gerado em supabase/migration_completa_supabase.sql com sucesso!');
