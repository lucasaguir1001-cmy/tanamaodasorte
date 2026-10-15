-- ========================================================
-- Schema: Tá Na Mão da SORTE - Bingo Online / Loteria Digital
-- Supabase PostgreSQL Setup Script
-- ========================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enum for WhatsApp message types
DO $$ BEGIN
    CREATE TYPE tipo_mensagem AS ENUM ('lembrete', 'resultado', 'parabenizacao');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 1. Tabela usuarios
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nome_completo TEXT NOT NULL,
    cpf TEXT UNIQUE NOT NULL,
    whatsapp TEXT UNIQUE NOT NULL,
    data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Tabela sorteios
CREATE TABLE IF NOT EXISTS public.sorteios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    data_sorteio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    numeros_sorteados TEXT, -- ex: "1234"
    ganhador_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    premio NUMERIC(10, 2) DEFAULT 500.00 NOT NULL,
    acumulado BOOLEAN DEFAULT FALSE NOT NULL,
    status TEXT DEFAULT 'agendado' CHECK (status IN ('agendado', 'em_andamento', 'finalizado')),
    eh_domingo BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Tabela bilhetes
CREATE TABLE IF NOT EXISTS public.bilhetes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    numero_milhar VARCHAR(4) NOT NULL, -- "0000" até "9999"
    usuario_id UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    sorteio_id UUID REFERENCES public.sorteios(id) ON DELETE SET NULL,
    data_compra TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status_pagamento BOOLEAN DEFAULT FALSE NOT NULL,
    payment_id TEXT, -- ID da transação Mercado Pago
    valor NUMERIC(10, 2) DEFAULT 2.00 NOT NULL,
    CONSTRAINT unico_numero_por_sorteio UNIQUE (numero_milhar, sorteio_id)
);

-- 4. Tabela mensagens
CREATE TABLE IF NOT EXISTS public.mensagens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    tipo tipo_mensagem NOT NULL,
    data_envio TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    status_envio TEXT DEFAULT 'enviado'
);

-- Indexes for high performance searches
CREATE INDEX IF NOT EXISTS idx_bilhetes_numero ON public.bilhetes(numero_milhar);
CREATE INDEX IF NOT EXISTS idx_bilhetes_usuario ON public.bilhetes(usuario_id);
CREATE INDEX IF NOT EXISTS idx_bilhetes_sorteio ON public.bilhetes(sorteio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_cpf ON public.usuarios(cpf);
CREATE INDEX IF NOT EXISTS idx_usuarios_whatsapp ON public.usuarios(whatsapp);
CREATE INDEX IF NOT EXISTS idx_sorteios_data ON public.sorteios(data_sorteio);

-- Row Level Security (RLS) - Enable safe access
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bilhetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sorteios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mensagens ENABLE ROW LEVEL SECURITY;

-- Allow public read access to sorteios and public availability of bilhetes
CREATE POLICY "Public read sorteios" ON public.sorteios FOR SELECT USING (true);
CREATE POLICY "Public read bilhetes" ON public.bilhetes FOR SELECT USING (true);
CREATE POLICY "Public insert bilhetes" ON public.bilhetes FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read usuarios" ON public.usuarios FOR SELECT USING (true);
CREATE POLICY "Public insert usuarios" ON public.usuarios FOR INSERT WITH CHECK (true);
CREATE POLICY "Public read mensagens" ON public.mensagens FOR SELECT USING (true);
CREATE POLICY "Service role full access" ON public.mensagens FOR ALL USING (true);

-- ========================================================
-- 5. Portal de Afiliados
-- ========================================================

-- Tabela public.afiliados
CREATE TABLE IF NOT EXISTS public.afiliados (
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
    commission_rate NUMERIC(5, 2) NOT NULL DEFAULT 0.15,
    pix_key_type TEXT NOT NULL DEFAULT 'CPF',
    pix_key TEXT NOT NULL,
    social_channels TEXT,
    promotion_strategy TEXT,
    balance_available NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_pending NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    balance_paid NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    total_clicks INTEGER NOT NULL DEFAULT 0,
    total_conversions INTEGER NOT NULL DEFAULT 0,
    terms_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    privacy_accepted_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    approved_at TIMESTAMP WITH TIME ZONE,
    approved_by TEXT,
    parent_affiliate_id TEXT,
    parent_affiliate_code TEXT,
    parent_affiliate_name TEXT
);

-- Tabela public.afiliados_links
CREATE TABLE IF NOT EXISTS public.afiliados_links (
    id TEXT PRIMARY KEY,
    affiliate_id TEXT NOT NULL REFERENCES public.afiliados(id) ON DELETE CASCADE,
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

-- Índices Afiliados
CREATE INDEX IF NOT EXISTS idx_afiliados_email ON public.afiliados(email);
CREATE INDEX IF NOT EXISTS idx_afiliados_doc ON public.afiliados(document_number);
CREATE INDEX IF NOT EXISTS idx_afiliados_code ON public.afiliados(exclusive_code);
CREATE INDEX IF NOT EXISTS idx_afiliados_status ON public.afiliados(status);
CREATE INDEX IF NOT EXISTS idx_afiliados_links_aff ON public.afiliados_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_afiliados_links_code ON public.afiliados_links(affiliate_code);

-- RLS Afiliados
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliados_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read afiliados" ON public.afiliados FOR SELECT USING (true);
CREATE POLICY "Public insert afiliados" ON public.afiliados FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update afiliados" ON public.afiliados FOR UPDATE USING (true);
CREATE POLICY "Public read afiliados_links" ON public.afiliados_links FOR SELECT USING (true);
CREATE POLICY "Public insert afiliados_links" ON public.afiliados_links FOR INSERT WITH CHECK (true);
CREATE POLICY "Public update afiliados_links" ON public.afiliados_links FOR UPDATE USING (true);

