-- ========================================================
-- Schema: Portal de Afiliados - Tá Na Mão da SORTE
-- Script PostgreSQL para execução no Supabase SQL Editor
-- ========================================================

-- Remove tabelas existentes para recriar com todas as 28 colunas
DROP TABLE IF EXISTS public.afiliados_links CASCADE;
DROP TABLE IF EXISTS public.afiliados CASCADE;

-- 1. Tabela public.afiliados
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

-- 2. Tabela public.afiliados_links
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

-- Índices de Performance
CREATE INDEX IF NOT EXISTS idx_afiliados_email ON public.afiliados(email);
CREATE INDEX IF NOT EXISTS idx_afiliados_doc ON public.afiliados(document_number);
CREATE INDEX IF NOT EXISTS idx_afiliados_code ON public.afiliados(exclusive_code);
CREATE INDEX IF NOT EXISTS idx_afiliados_status ON public.afiliados(status);
CREATE INDEX IF NOT EXISTS idx_afiliados_links_aff ON public.afiliados_links(affiliate_id);
CREATE INDEX IF NOT EXISTS idx_afiliados_links_code ON public.afiliados_links(affiliate_code);

-- Row Level Security (RLS)
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliados_links ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso
DROP POLICY IF EXISTS "Public read afiliados" ON public.afiliados;
CREATE POLICY "Public read afiliados" ON public.afiliados FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert afiliados" ON public.afiliados;
CREATE POLICY "Public insert afiliados" ON public.afiliados FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update afiliados" ON public.afiliados;
CREATE POLICY "Public update afiliados" ON public.afiliados FOR UPDATE USING (true);

DROP POLICY IF EXISTS "Public read afiliados_links" ON public.afiliados_links;
CREATE POLICY "Public read afiliados_links" ON public.afiliados_links FOR SELECT USING (true);

DROP POLICY IF EXISTS "Public insert afiliados_links" ON public.afiliados_links;
CREATE POLICY "Public insert afiliados_links" ON public.afiliados_links FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Public update afiliados_links" ON public.afiliados_links;
CREATE POLICY "Public update afiliados_links" ON public.afiliados_links FOR UPDATE USING (true);
