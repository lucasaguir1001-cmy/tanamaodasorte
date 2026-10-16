-- ==============================================================================
-- Script de Atualização: Adição de Colunas para Rede de Subafiliados no Supabase
-- Execute este script no SQL Editor do seu projeto Supabase caso deseje manter
-- o banco de dados com colunas dedicadas. (O sistema já possui suporte e compatibilidade
-- automática mesmo sem executar este script).
-- ==============================================================================

ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS parent_affiliate_id TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS parent_affiliate_code TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS parent_affiliate_name TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5, 2) DEFAULT 0.15;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS birth_date TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS state TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS balance_available NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS balance_pending NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS balance_paid NUMERIC(10, 2) DEFAULT 0.00;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS total_clicks INTEGER DEFAULT 0;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS total_conversions INTEGER DEFAULT 0;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS approved_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.afiliados ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now());

-- Cria índices para buscas rápidas por patrocinador e código
CREATE INDEX IF NOT EXISTS idx_afiliados_parent_code ON public.afiliados(parent_affiliate_code);
CREATE INDEX IF NOT EXISTS idx_afiliados_parent_id ON public.afiliados(parent_affiliate_id);
