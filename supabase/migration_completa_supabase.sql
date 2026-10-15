-- ========================================================
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
    usuario_id TEXT NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    sorteio_id TEXT REFERENCES public.sorteios(id) ON DELETE SET NULL,
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

-- Inserindo 46 Usuarios
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790672955015_idt38', 'Mario Vieira', '33693883824', '84998144639', '2026-09-29T09:09:15.015+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790697390180_cbobk', 'William Honorio', '28809789067', '11940605073', '2026-09-29T15:56:30.18+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791813510856_5h2kv', 'Jardel Jânio Cassiano do Nascimento', '32524260801', '11982399525', '2026-10-12T13:58:29.949+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790440920239_b174q', 'Cristiano Alcântara', '08904223466', '83988082452', '2026-09-26T16:42:00.239+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1792027577789_lp3ja', 'Joseane Cassiano Chaves', '10487801806', '83998081607', '2026-10-15T01:26:17.789+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790713510778_bfqnx', 'Patricia da Silva Martins', '08261747441', '83986714617', '2026-09-29T20:25:10.778+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790710043207_xa2o0', 'Julio Cesar', '04268479465', '83998081165', '2026-09-29T19:27:23.207+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791820318336_vtqy0', 'Francisco Gomes', '39635600453', '83996139572', '2026-10-12T15:51:58.336+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790513988929_g7kj7', 'Wisley Azevdedo Da Silva', '01807738442', '83921460279', '2026-09-27T12:59:48.929+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790442049136_x1ipf', 'Guarabira Silva', '33693683824', '83982137357', '2026-09-26T17:00:49.136+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790539595814_d7e6w', 'Elaine pereira', '42891606892', '11959917590', '2026-09-27T20:06:35.814+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790544359264_u0vaz', 'Alvoro neguinho', '91482766500', '11914827665', '2026-09-27T21:25:59.264+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790544737309_zxg6e', 'Ricardo Galtierre', '25964596436', '11982746095', '2026-09-27T21:32:17.309+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791109559477_znvlb', 'Mailson Vieira da silva', '09418597462', '83998515864', '2026-10-04T10:25:59.477+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791278848223_c0e08', 'Mário vieira', '71970878487', '84988651582', '2026-10-06T09:27:28.223+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791280681378_h7fqq', 'Teste', '61626277727', '31618313461', '2026-10-06T09:58:01.378+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1792048308321_7xz8j', 'Jacaraú da Silva', '95122729468', '83996389414', '2026-10-15T07:11:48.321+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791455979176_y0rjd', 'Paulo', '32699745233', '83986453215', '2026-10-08T10:39:39.176+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791748399115_r9fhm', 'Maria Paula', '25869365987', '11963896357', '2026-10-11T19:53:19.115+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790433298786_mdv3c', 'Henrique Pereira', '28803773827', '11984352781', '2026-09-26T14:34:58.786+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791285634978_aslhv', 'Mario Vieira', '33693638824', '84998144639', '2026-10-06T11:20:34.978+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791300664675_nicz3', 'Diego Sales Martins', '07276846474', '83999095934', '2026-10-06T15:31:04.675+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791302551286_m31xg', 'Matheuss Almeida', '13076541420', '83993040415', '2026-10-06T16:02:31.286+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791588640384_v3y4i', 'Maria Celia', '22896325963', '11963289425', '2026-10-09T23:30:40.384+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791633876034_4c0qs', 'Maria Jose', '27896789700', '11986759780', '2026-10-10T12:04:36.034+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791315273849_cujuk', 'Enzo silva', '72282822389', '11958236699', '2026-10-06T19:34:33.849+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791677514913_6jj7r', 'Alecsandro Costa Madaleno', '03509760400', '8498876407', '2026-10-11T00:11:54.913+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791317897932_d6bik', 'José vagner da Silva Pereira', '04081931402', '83986595972', '2026-10-06T20:18:17.932+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790602535451_zq2oe', 'Willian Honório', '39930448861', '11940605073', '2026-09-28T13:35:35.451+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791305469619_kyuos', 'Diego Pedro', '90333692497', '84991089790', '2026-10-06T16:51:09.619+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790624215861_g3fmi', 'Ana Raquel Gomes da silva', '01098830474', '83996969875', '2026-09-28T19:36:55.861+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790627691190_yxt13', 'Caiohenriqur', '70155680474', '83993483794', '2026-09-28T20:34:51.19+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790629774484_neh1g', 'Alysson nascimento da Silva', '04287628403', '83998809795', '2026-09-28T21:09:34.484+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790655579592_z921q', 'Jamie Martin', '55555555555', '6049207584', '2026-09-29T04:19:39.592+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790672076637_73v8s', 'Nathan Alexandre de brito', '70595546455', '83999314288', '2026-09-29T08:54:36.637+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791362100953_zjjoe', 'Lucas da franca', '70882442414', '83993446530', '2026-10-07T08:35:00.953+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791303374757_spfoh', 'Fabiano geronimo da Silva', '01248930401', '83988682237', '2026-10-06T16:16:14.757+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791375367036_ag1sm', 'José Edinaldo', '79018050482', '83991506621', '2026-10-07T12:16:07.036+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791380865915_q4xov', 'Christrrone da Silva', '07650972496', '8399686840', '2026-10-07T13:47:45.915+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791749673287_oag5r', 'Henrique pereira', '28807378920', '11984352781', '2026-10-11T20:14:33.287+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1790437855155_iwiph', 'Alecsandro Costa Madaleno', '03509760409', '84987076407', '2026-09-26T15:50:55.156+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791742897333_4h0qk', 'Queila tamires de Andrade Silva', '12173060481', '83996062518', '2026-10-11T18:21:36.048+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791831241285_ls09l', 'Rafael Da Silva Campos', '70123901405', '83998908210', '2026-10-12T18:54:01.285+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791745465775_opva6', 'Ademark Vieira De Lima', '02812548428', '83996545203', '2026-10-11T19:04:25.775+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_1791801596343_fngwj', 'Talis Saldanha da Silva', '09596093428', '83999449947', '2026-10-12T10:39:56.343+00:00') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES ('usr_22692896802', 'Maria clara', '22692896802', '11984357090', '2026-10-12T20:34:41.165+00:00') ON CONFLICT (id) DO NOTHING;

-- Inserindo 18 Sorteios
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1790552467648_s7z4g', '2026-09-28T22:00:00+00:00', '9505', NULL, 500, TRUE, 'finalizado', FALSE, '2026-10-15T12:17:15.414Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1790632802196_8qe61', '2026-09-29T22:00:00+00:00', '0921', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1790719467759_cqh8w', '2026-09-30T22:00:00+00:00', '4081', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1790808774818_hzt5u', '2026-10-01T22:00:00+00:00', '3099', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1790895713155_pe0fw', '2026-10-02T22:00:00+00:00', '5745', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791007019763_1p9t3', '2026-10-03T22:00:00+00:00', '7276', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791065352924_qyhp6', '2026-10-04T22:00:00+00:00', '0033', 'usr_1791109559477_znvlb', 500, FALSE, 'finalizado', TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791158328567_stia6', '2026-10-05T22:00:00+00:00', '1512', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791250383038_22x54', '2026-10-06T22:00:00+00:00', '4098', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791324580322_564fc', '2026-10-07T22:00:00+00:00', '1941', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791410432245_yxujm', '2026-10-08T22:00:00+00:00', '4238', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791497670062_qhowc', '2026-10-09T22:00:00+00:00', '6898', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791583201803_qt6nk', '2026-10-10T22:00:00+00:00', '9507', NULL, 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791671968935_6uc3m', '2026-10-11T22:00:00+00:00', '8526', 'usr_1790442049136_x1ipf', 500, FALSE, 'finalizado', TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791756831084_7xv3q', '2026-10-12T22:00:00+00:00', '6786', 'usr_22692896802', 500, FALSE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791842551621_byfu3', '2026-10-13T22:00:00+00:00', '6212', NULL, 500, TRUE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1792015705805_8sbfw', '2026-10-15T22:00:00+00:00', NULL, NULL, 500, FALSE, 'agendado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES ('sorteio_1791929405443_rpm9g', '2026-10-14T22:00:00+00:00', '7531', NULL, 500, TRUE, 'finalizado', FALSE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;

-- Inserindo 5 Bilhetes
INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES ('bilhete_1792047480741_2181', '2181', 'usr_1790442049136_x1ipf', 'sorteio_1792015705805_8sbfw', '2026-10-15T06:58:00.741+00:00', TRUE, NULL, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES ('bilhete_1792047480741_2620', '2620', 'usr_1790442049136_x1ipf', 'sorteio_1792015705805_8sbfw', '2026-10-15T06:58:00.741+00:00', TRUE, NULL, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES ('bilhete_1792048629514_6143', '6143', 'usr_1792048308321_7xz8j', 'sorteio_1792015705805_8sbfw', '2026-10-15T07:17:09.514+00:00', TRUE, NULL, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES ('bilhete_1792048629514_6938', '6938', 'usr_1792048308321_7xz8j', 'sorteio_1792015705805_8sbfw', '2026-10-15T07:17:09.514+00:00', TRUE, NULL, 2) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES ('bilhete_1792048629514_5017', '5017', 'usr_1792048308321_7xz8j', 'sorteio_1792015705805_8sbfw', '2026-10-15T07:17:09.514+00:00', TRUE, NULL, 2) ON CONFLICT (id) DO NOTHING;

-- Inserindo 8 Afiliados
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('abb024d4-6700-4926-84ff-f009cf3f7bc1', 'test_status@sorte.com', 'test_status@sorte.com', '', 'CPF', '99988877766', '', '', NULL, 'Brasil', 'SP', 'STAT-1234', 'qualquer_coisa', NULL, 0.15, 'CPF', '99988877766', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('fcb24ee6-d784-42d1-9aa1-719953a493ba', 'afiliado_teste_1791302962323@teste.com', 'afiliado_teste_1791302962323@teste.com', '', 'CPF', '38927163829', '', '', NULL, 'Brasil', 'SP', 'AFIL-9988', 'cancelado', NULL, 0.15, 'CPF', '38927163829', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('9dce1524-41c6-4b83-a378-354ef0fcfc96', 'deleted_9dce1524-41c6-4b83-a378-354ef0fcfc96@sorte.com', 'deleted_9dce1524-41c6-4b83-a378-354ef0fcfc96@sorte.com', '', 'CPF', '00000000000', '', '', NULL, 'Brasil', 'SP', 'DEL-9dce', 'aprovado', NULL, 0.15, 'CPF', '00000000000', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('61a20b9c-fb98-4b6c-b7f3-7a52822a29bc', 'firmezinha1@hotmail.com', 'firmezinha1@hotmail.com', '', 'CPF', '28803773827', '', '', NULL, 'Brasil', 'SP', 'FLAV-5860', 'aprovado#pwd:Enzo010216', NULL, 0.15, 'CPF', '28803773827', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('5a7287b8-256f-479f-a005-098f263a73ce', 'test_link@sorte.com', 'test_link@sorte.com', '', 'CPF', '11122233344', '', '', NULL, 'Brasil', 'SP', 'LINK-1234', 'aprovado', NULL, 0.15, 'CPF', '11122233344', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('1ad9975d-7abd-4aa7-b35a-327e350444f3', 'mariovieira071286@gmail.com', 'mariovieira071286@gmail.com', '', 'CPF', '33693683824', '', '', NULL, 'Brasil', 'SP', 'MARI-7996', 'aprovado#pwd:Nicolas2024@', NULL, 0.15, 'CPF', '33693683824', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('4db9596a-2cda-4f0f-b9bd-5364cd371f8c', 'queilatamires80@gmail.com', 'queilatamires80@gmail.com', '', 'CPF', '12173060481', '', '', NULL, 'Brasil', 'SP', 'QUEI-2032', 'aprovado#pwd:88141270Feio', NULL, 0.15, 'CPF', '12173060481', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES ('4c4f7aaa-ccbd-4ae3-9535-78f01f60db0d', 'jardeljaniocassiano5@gmail.com', 'jardeljaniocassiano5@gmail.com', '', 'CPF', '32524260801', '', '', NULL, 'Brasil', 'SP', 'JARD-1161', 'aprovado#pwd:#Amor1010', NULL, 0.15, 'CPF', '32524260801', '', '', 0, 0, 0, 0, 0, '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', '2026-10-15T12:17:15.415Z', NULL, NULL) ON CONFLICT (id) DO NOTHING;

-- Inserindo 5 Links de Afiliados
INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES ('eecca770-83d6-40fe-a5fd-a8094a278ca9', '5a7287b8-256f-479f-a005-098f263a73ce', 'LINK-1234', '/', 'padrao', 'https://tanamaodasorte.com.br/?afiliado=LINK-1234', 0, 0, 0, TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES ('26a112a2-fc57-4541-8514-66d99c478b29', '61a20b9c-fb98-4b6c-b7f3-7a52822a29bc', 'FLAV-5860', '/', 'padrao', 'https://tanamaodasorte.com.br/?afiliado=FLAV-5860', 0, 0, 0, TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES ('29caf666-afdd-473c-ac65-2642c53ce9cf', '1ad9975d-7abd-4aa7-b35a-327e350444f3', 'MARI-7996', '/', 'padrao', 'https://tanamaodasorte.com.br/?afiliado=MARI-7996', 0, 0, 0, TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES ('2b29dcb7-2669-4b0b-ab9b-3b9cd2427315', '4db9596a-2cda-4f0f-b9bd-5364cd371f8c', 'QUEI-2032', '/', 'padrao', 'https://tanamaodasorte.com.br/?afiliado=QUEI-2032', 0, 0, 0, TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES ('e4066f2c-967f-46a8-95e5-3e4d4350cfd7', '4c4f7aaa-ccbd-4ae3-9535-78f01f60db0d', 'JARD-1161', '/', 'padrao', 'https://tanamaodasorte.com.br/?afiliado=JARD-1161', 0, 0, 0, TRUE, '2026-10-15T12:17:15.415Z') ON CONFLICT (id) DO NOTHING;

-- Inserindo 35 Mensagens / Comissoes
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_1791744584872_mario', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '33693683824', '{"id":"comm_1791744584872_mario","conversionId":"conv_1791744584872_3265","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Mario vieira da Silva","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Mario vieira da Silva","buyerFirstName":"Mario","buyerCpf":"33693683824","ticketsCount":1,"tickets":["3265"],"createdAt":"2026-10-11T18:49:44.872Z"}', 'comissao', '2026-10-11T18:49:44.872+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_1791745650910_queila', NULL, '4db9596a-2cda-4f0f-b9bd-5364cd371f8c', '02812548428', '{"id":"comm_1791745650910_queila","conversionId":"conv_1791745650910_0304","affiliateId":"4db9596a-2cda-4f0f-b9bd-5364cd371f8c","affiliateCode":"QUEI-2032","affiliateName":"Queila tamires de Andrade Silva","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Ademark Vieira De Lima","buyerFirstName":"Ademark","buyerCpf":"02812548428","ticketsCount":1,"tickets":["0304"],"createdAt":"2026-10-11T19:07:30.910Z"}', 'comissao', '2026-10-11T19:07:30.91+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_1791748800000_flavio', NULL, '61a20b9c-fb98-4b6c-b7f3-7a52822a29bc', '28803773827', '{"id":"comm_1791748800000_flavio","conversionId":"conv_1791748800000_flav","affiliateId":"61a20b9c-fb98-4b6c-b7f3-7a52822a29bc","affiliateCode":"FLAV-5860","affiliateName":"Flavio Henrique da Silva","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Flavio henrique","buyerFirstName":"Flavio","buyerCpf":"28803773827","ticketsCount":1,"tickets":["7630"],"createdAt":"2026-10-11T19:53:19.115Z"}', 'comissao', '2026-10-11T19:53:19.115+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183670278962', NULL, NULL, '84998144639', '{"id":"183670278962","paymentId":"183670278962","tickets":["8526"],"amount":2,"userName":"Mario Vieira","userCpf":"33693683824","userWhatsapp":"84998144639","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-11T20:14:33.893Z","expiresAt":"2026-10-11T20:29:34.661Z"}', 'reserva', '2026-10-11T20:14:33.893+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183670191168', NULL, NULL, '11984352781', '{"id":"183670191168","paymentId":"183670191168","tickets":["1800"],"amount":2,"userName":"Henrique pereira","userCpf":"28807378920","userWhatsapp":"11984352781","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-11T20:14:52.596Z","expiresAt":"2026-10-11T20:29:53.183Z"}', 'reserva', '2026-10-11T20:14:52.596+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183670278962', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '33693683824', '{"id":"comm_183670278962","conversionId":"conv_183670278962","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Mario Vieira","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Mario Vieira","buyerFirstName":"Mario","buyerCpf":"33693683824","ticketsCount":1,"tickets":["8526"],"createdAt":"2026-10-11T20:15:22.374Z"}', 'comissao', '2026-10-11T20:15:22.374+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183670191168', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '28807378920', '{"id":"comm_183670191168","conversionId":"conv_183670191168","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Mario Vieira","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Henrique pereira","buyerFirstName":"Henrique","buyerCpf":"28807378920","ticketsCount":1,"tickets":["1800"],"createdAt":"2026-10-11T20:15:44.909Z"}', 'comissao', '2026-10-11T20:15:44.909+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_182660508195', NULL, NULL, '83996139572', '{"id":"182660508195","paymentId":"182660508195","tickets":["5343"],"amount":2,"userName":"Francisco Gomes","userCpf":"33693683824","userWhatsapp":"83996139572","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-11T21:33:57.799Z","expiresAt":"2026-10-11T21:48:58.089Z"}', 'reserva', '2026-10-11T21:33:57.799+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_182660508195', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '33693683824', '{"id":"comm_182660508195","conversionId":"conv_182660508195","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Francisco Gomes","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Francisco Gomes","buyerFirstName":"Francisco","buyerCpf":"33693683824","ticketsCount":1,"tickets":["5343"],"createdAt":"2026-10-11T21:34:55.603Z"}', 'comissao', '2026-10-11T21:34:55.603+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_182679962281', NULL, NULL, '83996062518', '{"id":"182679962281","paymentId":"182679962281","tickets":["6026"],"amount":2,"userName":"Queila tamires de Andrade Silva","userCpf":"12173060481","userWhatsapp":"83996062518","affiliateCode":"QUEI-2032","campaign":"padrao","status":"pending","createdAt":"2026-10-11T23:53:48.054Z","expiresAt":"2026-10-12T00:08:48.340Z"}', 'reserva', '2026-10-11T23:53:48.054+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_182679962281', NULL, '4db9596a-2cda-4f0f-b9bd-5364cd371f8c', '12173060481', '{"id":"comm_182679962281","conversionId":"conv_182679962281","affiliateId":"4db9596a-2cda-4f0f-b9bd-5364cd371f8c","affiliateCode":"QUEI-2032","affiliateName":"Queila tamires de Andrade Silva","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Queila tamires de Andrade Silva","buyerFirstName":"Queila","buyerCpf":"12173060481","ticketsCount":1,"tickets":["6026"],"createdAt":"2026-10-11T23:54:36.106Z"}', 'comissao', '2026-10-11T23:54:36.106+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183721247480', NULL, NULL, '83996545203', '{"id":"183721247480","paymentId":"183721247480","tickets":["2113"],"amount":2,"userName":"Ademark Vieira De Lima","userCpf":"02812548428","userWhatsapp":"83996545203","affiliateCode":"QUEI-2032","campaign":"padrao","status":"pending","createdAt":"2026-10-12T03:10:00.012Z","expiresAt":"2026-10-12T03:25:00.311Z"}', 'reserva', '2026-10-12T03:10:00.012+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183721247480', NULL, '4db9596a-2cda-4f0f-b9bd-5364cd371f8c', '02812548428', '{"id":"comm_183721247480","conversionId":"conv_183721247480","affiliateId":"4db9596a-2cda-4f0f-b9bd-5364cd371f8c","affiliateCode":"QUEI-2032","affiliateName":"Queila tamires de Andrade Silva","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Ademark Vieira De Lima","buyerFirstName":"Ademark","buyerCpf":"02812548428","ticketsCount":1,"tickets":["2113"],"createdAt":"2026-10-12T03:10:50.365Z"}', 'comissao', '2026-10-12T03:10:50.365+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183739530022', NULL, NULL, '83999449947', '{"id":"183739530022","paymentId":"183739530022","tickets":["7778"],"amount":2,"userName":"Talis Saldanha da Silva","userCpf":"09596093428","userWhatsapp":"83999449947","affiliateCode":"QUEI-2032","campaign":"padrao","status":"pending","createdAt":"2026-10-12T10:40:19.250Z","expiresAt":"2026-10-12T10:55:19.771Z"}', 'reserva', '2026-10-12T10:40:19.25+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183766637502', NULL, NULL, '11982399525', '{"id":"183766637502","paymentId":"183766637502","tickets":["3355"],"amount":2,"userName":"JARDEL JANIO CASSIANO DO NASCIMENTO","userCpf":"32524260801","userWhatsapp":"11982399525","affiliateCode":"JARD-1161","campaign":"padrao","status":"pending","createdAt":"2026-10-12T14:44:30.432Z","expiresAt":"2026-10-12T14:59:30.739Z"}', 'reserva', '2026-10-12T14:44:30.432+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183766637502', NULL, '4c4f7aaa-ccbd-4ae3-9535-78f01f60db0d', '32524260801', '{"id":"comm_183766637502","conversionId":"conv_183766637502","affiliateId":"4c4f7aaa-ccbd-4ae3-9535-78f01f60db0d","affiliateCode":"JARD-1161","affiliateName":"JARDEL JANIO CASSIANO DO NASCIMENTO","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"JARDEL JANIO CASSIANO DO NASCIMENTO","buyerFirstName":"JARDEL","buyerCpf":"32524260801","ticketsCount":1,"tickets":["3355"],"createdAt":"2026-10-12T14:45:21.347Z"}', 'comissao', '2026-10-12T14:45:21.347+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183778331560', NULL, NULL, '83996139572', '{"id":"183778331560","paymentId":"183778331560","tickets":["1849"],"amount":2,"userName":"Francisco Gomes","userCpf":"39635600453","userWhatsapp":"83996139572","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-12T15:53:42.900Z","expiresAt":"2026-10-12T16:08:43.431Z"}', 'reserva', '2026-10-12T15:53:42.9+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183778331560', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '39635600453', '{"id":"comm_183778331560","conversionId":"conv_183778331560","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Francisco Gomes","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Francisco Gomes","buyerFirstName":"Francisco","buyerCpf":"39635600453","ticketsCount":1,"tickets":["1849"],"createdAt":"2026-10-12T15:57:06.152Z"}', 'comissao', '2026-10-12T15:57:06.152+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183782951836', NULL, NULL, '11984352781', '{"id":"183782951836","paymentId":"183782951836","tickets":["1322"],"amount":2,"userName":"Henrique Pereira","userCpf":"28803773827","userWhatsapp":"11984352781","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-12T16:21:45.837Z","expiresAt":"2026-10-12T16:36:46.478Z"}', 'reserva', '2026-10-12T16:21:45.837+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183782951836', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '28803773827', '{"id":"comm_183782951836","conversionId":"conv_183782951836","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Francisco Gomes","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Henrique Pereira","buyerFirstName":"Henrique","buyerCpf":"28803773827","ticketsCount":1,"tickets":["1322"],"createdAt":"2026-10-12T16:23:13.564Z"}', 'comissao', '2026-10-12T16:23:13.564+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183789784656', NULL, NULL, '84998144639', '{"id":"183789784656","paymentId":"183789784656","tickets":["6186"],"amount":2,"userName":"Mario Vieira","userCpf":"33693683824","userWhatsapp":"84998144639","affiliateCode":"FLAV-5860","campaign":"padrao","status":"pending","createdAt":"2026-10-12T16:58:52.722Z","expiresAt":"2026-10-12T17:13:53.037Z"}', 'reserva', '2026-10-12T16:58:52.722+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183788933916', NULL, NULL, '84987076407', '{"id":"183788933916","paymentId":"183788933916","tickets":["3377"],"amount":2,"userName":"Alecsandro Costa Madaleno","userCpf":"03509760409","userWhatsapp":"84987076407","affiliateCode":"FLAV-5860","campaign":"padrao","status":"pending","createdAt":"2026-10-12T16:59:03.496Z","expiresAt":"2026-10-12T17:14:03.799Z"}', 'reserva', '2026-10-12T16:59:03.496+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183789784656', NULL, '61a20b9c-fb98-4b6c-b7f3-7a52822a29bc', '33693683824', '{"id":"comm_183789784656","conversionId":"conv_183789784656","affiliateId":"61a20b9c-fb98-4b6c-b7f3-7a52822a29bc","affiliateCode":"FLAV-5860","affiliateName":"Henrique Pereira","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Mario Vieira","buyerFirstName":"Mario","buyerCpf":"33693683824","ticketsCount":1,"tickets":["6186"],"createdAt":"2026-10-12T17:00:25.174Z"}', 'comissao', '2026-10-12T17:00:25.174+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183788933916', NULL, '61a20b9c-fb98-4b6c-b7f3-7a52822a29bc', '03509760409', '{"id":"comm_183788933916","conversionId":"conv_183788933916","affiliateId":"61a20b9c-fb98-4b6c-b7f3-7a52822a29bc","affiliateCode":"FLAV-5860","affiliateName":"Henrique Pereira","orderAmount":2,"commissionRate":0.15,"commissionAmount":0.3,"campaign":"padrao","status":"pendente","buyerName":"Alecsandro Costa Madaleno","buyerFirstName":"Alecsandro","buyerCpf":"03509760409","ticketsCount":1,"tickets":["3377"],"createdAt":"2026-10-12T17:00:27.167Z"}', 'comissao', '2026-10-12T17:00:27.167+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_182785486247', NULL, NULL, '83998908210', '{"id":"182785486247","paymentId":"182785486247","tickets":["6952"],"amount":2,"userName":"Rafael Da Silva Campos","userCpf":"70123901405","userWhatsapp":"83998908210","status":"pending","createdAt":"2026-10-12T18:54:51.138Z","expiresAt":"2026-10-12T19:09:51.714Z"}', 'reserva', '2026-10-12T18:54:51.138+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_182784723611', NULL, NULL, '83998908210', '{"id":"182784723611","paymentId":"182784723611","tickets":["6952","0695"],"amount":4,"userName":"Rafael Da Silva Campos","userCpf":"70123901405","userWhatsapp":"83998908210","status":"pending","createdAt":"2026-10-12T18:56:20.183Z","expiresAt":"2026-10-12T19:11:20.803Z"}', 'reserva', '2026-10-12T18:56:20.183+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_182785969067', NULL, NULL, '11982399525', '{"id":"182785969067","paymentId":"182785969067","tickets":["6459","7982","4071","2288","8459"],"amount":10,"userName":"JARDEL JANIO CASSIANO DO NASCIMENTO","userCpf":"32524260801","userWhatsapp":"11982399525","affiliateCode":"JARD-1161","campaign":"padrao","status":"pending","createdAt":"2026-10-12T19:02:47.523Z","expiresAt":"2026-10-12T19:17:47.818Z"}', 'reserva', '2026-10-12T19:02:47.523+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_182785969067', NULL, '4c4f7aaa-ccbd-4ae3-9535-78f01f60db0d', '32524260801', '{"id":"comm_182785969067","conversionId":"conv_182785969067","affiliateId":"4c4f7aaa-ccbd-4ae3-9535-78f01f60db0d","affiliateCode":"JARD-1161","affiliateName":"JARDEL JANIO CASSIANO DO NASCIMENTO","orderAmount":10,"commissionRate":0.15,"commissionAmount":1.5,"campaign":"padrao","status":"pendente","buyerName":"JARDEL JANIO CASSIANO DO NASCIMENTO","buyerFirstName":"JARDEL","buyerCpf":"32524260801","ticketsCount":5,"tickets":["6459","7982","4071","2288","8459"],"createdAt":"2026-10-12T19:08:20.503Z"}', 'comissao', '2026-10-12T19:08:20.503+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('sorteado_programado_active', NULL, 'usr_22692896802', '11984357090', '{"id":"sorteado_1791837281643","nome_completo":"Maria clara","cpf":"22692896802","whatsapp":"11984357090","numero_milhar":"6786","ativo":false,"criado_em":"2026-10-12T20:34:41.643Z","utilizado_em":"sorteio_1791756831084_7xv3q"}', 'sorteado_programado', '2026-10-12T20:34:41.643+00:00', 'inativo') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_184230167952', NULL, NULL, '83998081607', '{"id":"184230167952","paymentId":"184230167952","tickets":["6823","6911","9155","3604","6588"],"amount":10,"userName":"Joseane Cassiano Chaves","userCpf":"10487801806","userWhatsapp":"83998081607","affiliateCode":"JARD-1161","campaign":"padrao","status":"pending","createdAt":"2026-10-15T01:29:09.364Z","expiresAt":"2026-10-15T01:44:09.655Z"}', 'reserva', '2026-10-15T01:29:09.364+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183224466493', NULL, NULL, '83982137357', '{"id":"183224466493","paymentId":"183224466493","tickets":["2527"],"amount":2,"userName":"Guarabira Silva","userCpf":"33693683824","userWhatsapp":"83982137357","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-15T06:55:04.261Z","expiresAt":"2026-10-15T07:10:04.777Z"}', 'reserva', '2026-10-15T06:55:04.261+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_183224722277', NULL, NULL, '83982137357', '{"id":"183224722277","paymentId":"183224722277","tickets":["2181","2620"],"amount":4,"userName":"Guarabira Silva","userCpf":"33693683824","userWhatsapp":"83982137357","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-15T06:57:05.844Z","expiresAt":"2026-10-15T07:12:06.362Z"}', 'reserva', '2026-10-15T06:57:05.844+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_183224722277', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '33693683824', '{"id":"comm_183224722277","conversionId":"conv_183224722277","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Guarabira Silva","orderAmount":4,"commissionRate":0.15,"commissionAmount":0.6,"campaign":"padrao","status":"pendente","buyerName":"Guarabira Silva","buyerFirstName":"Guarabira","buyerCpf":"33693683824","ticketsCount":2,"tickets":["2181","2620"],"createdAt":"2026-10-15T06:58:06.037Z"}', 'comissao', '2026-10-15T06:58:06.037+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('res_184248499954', NULL, NULL, '83996389414', '{"id":"184248499954","paymentId":"184248499954","tickets":["6143","6938","5017"],"amount":6,"userName":"Jacaraú da Silva","userCpf":"95122729468","userWhatsapp":"83996389414","affiliateCode":"MARI-7996","campaign":"padrao","status":"pending","createdAt":"2026-10-15T07:12:09.404Z","expiresAt":"2026-10-15T07:27:09.689Z"}', 'reserva', '2026-10-15T07:12:09.404+00:00', 'pending') ON CONFLICT (id) DO NOTHING;
INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES ('comm_184248499954', NULL, '1ad9975d-7abd-4aa7-b35a-327e350444f3', '95122729468', '{"id":"comm_184248499954","conversionId":"conv_184248499954","affiliateId":"1ad9975d-7abd-4aa7-b35a-327e350444f3","affiliateCode":"MARI-7996","affiliateName":"Guarabira Silva","orderAmount":6,"commissionRate":0.15,"commissionAmount":0.9,"campaign":"padrao","status":"pendente","buyerName":"Jacaraú da Silva","buyerFirstName":"Jacaraú","buyerCpf":"95122729468","ticketsCount":3,"tickets":["6143","6938","5017"],"createdAt":"2026-10-15T07:17:10.826Z"}', 'comissao', '2026-10-15T07:17:10.826+00:00', 'pendente') ON CONFLICT (id) DO NOTHING;

