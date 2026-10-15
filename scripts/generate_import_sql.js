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

let sql = `-- ==========================================
-- SCRIPT DE MIGRACAO DE TODOS OS DADOS DO SUPABASE
-- Execute no SQL Editor do NOVO projeto Supabase
-- ==========================================

`;

// 1. Usuarios
if (backup.usuarios && backup.usuarios.length > 0) {
  sql += `-- 1. USUARIOS (${backup.usuarios.length} cadastros)\n`;
  for (const u of backup.usuarios) {
    sql += `INSERT INTO public.usuarios (id, nome_completo, cpf, whatsapp, data_cadastro) VALUES (${escapeSql(u.id)}, ${escapeSql(u.nome_completo)}, ${escapeSql(u.cpf)}, ${escapeSql(u.whatsapp)}, ${escapeSql(u.data_cadastro)}) ON CONFLICT (cpf) DO UPDATE SET nome_completo = EXCLUDED.nome_completo, whatsapp = EXCLUDED.whatsapp;\n`;
  }
  sql += '\n';
}

// 2. Sorteios
if (backup.sorteios && backup.sorteios.length > 0) {
  sql += `-- 2. SORTEIOS (${backup.sorteios.length} registros)\n`;
  for (const s of backup.sorteios) {
    sql += `INSERT INTO public.sorteios (id, data_sorteio, numeros_sorteados, ganhador_id, premio, acumulado, status, eh_domingo, created_at) VALUES (${escapeSql(s.id)}, ${escapeSql(s.data_sorteio)}, ${escapeSql(s.numeros_sorteados)}, ${escapeSql(s.ganhador_id)}, ${escapeSql(s.premio || 500)}, ${escapeSql(s.acumulado || false)}, ${escapeSql(s.status || 'agendado')}, ${escapeSql(s.eh_domingo || false)}, ${escapeSql(s.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 3. Bilhetes
if (backup.bilhetes && backup.bilhetes.length > 0) {
  sql += `-- 3. BILHETES (${backup.bilhetes.length} registros)\n`;
  for (const b of backup.bilhetes) {
    sql += `INSERT INTO public.bilhetes (id, numero_milhar, usuario_id, sorteio_id, data_compra, status_pagamento, payment_id, valor) VALUES (${escapeSql(b.id)}, ${escapeSql(b.numero_milhar)}, ${escapeSql(b.usuario_id)}, ${escapeSql(b.sorteio_id)}, ${escapeSql(b.data_compra)}, ${escapeSql(b.status_pagamento)}, ${escapeSql(b.payment_id)}, ${escapeSql(b.valor || 2.00)}) ON CONFLICT DO NOTHING;\n`;
  }
  sql += '\n';
}

// 4. Afiliados
if (backup.afiliados && backup.afiliados.length > 0) {
  sql += `-- 4. AFILIADOS (${backup.afiliados.length} cadastros)\n`;
  for (const a of backup.afiliados) {
    sql += `INSERT INTO public.afiliados (id, full_name, email, password, document_type, document_number, phone, whatsapp, birth_date, city, state, exclusive_code, status, rejection_reason, commission_rate, pix_key_type, pix_key, social_channels, promotion_strategy, balance_available, balance_pending, balance_paid, total_clicks, total_conversions, terms_accepted_at, privacy_accepted_at, created_at, approved_at, approved_by) VALUES (${escapeSql(a.id)}, ${escapeSql(a.full_name || a.email)}, ${escapeSql(a.email)}, ${escapeSql(a.password || '')}, ${escapeSql(a.document_type || 'CPF')}, ${escapeSql(a.document_number)}, ${escapeSql(a.phone || a.whatsapp || '')}, ${escapeSql(a.whatsapp || '')}, ${escapeSql(a.birth_date)}, ${escapeSql(a.city || 'Brasil')}, ${escapeSql(a.state || 'SP')}, ${escapeSql(a.exclusive_code)}, ${escapeSql(a.status || 'pendente')}, ${escapeSql(a.rejection_reason)}, ${escapeSql(a.commission_rate || 0.15)}, ${escapeSql(a.pix_key_type || 'CPF')}, ${escapeSql(a.pix_key || a.document_number)}, ${escapeSql(a.social_channels || '')}, ${escapeSql(a.promotion_strategy || '')}, ${escapeSql(a.balance_available || 0)}, ${escapeSql(a.balance_pending || 0)}, ${escapeSql(a.balance_paid || 0)}, ${escapeSql(a.total_clicks || 0)}, ${escapeSql(a.total_conversions || 0)}, ${escapeSql(a.terms_accepted_at || new Date().toISOString())}, ${escapeSql(a.privacy_accepted_at || new Date().toISOString())}, ${escapeSql(a.created_at || new Date().toISOString())}, ${escapeSql(a.approved_at)}, ${escapeSql(a.approved_by)}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 5. Afiliados Links
if (backup.afiliados_links && backup.afiliados_links.length > 0) {
  sql += `-- 5. AFILIADOS LINKS (${backup.afiliados_links.length} registros)\n`;
  for (const l of backup.afiliados_links) {
    sql += `INSERT INTO public.afiliados_links (id, affiliate_id, affiliate_code, destination_path, campaign_name, full_url, clicks_count, conversions_count, revenue_generated, is_active, created_at) VALUES (${escapeSql(l.id)}, ${escapeSql(l.affiliate_id)}, ${escapeSql(l.affiliate_code)}, ${escapeSql(l.destination_path || '/')}, ${escapeSql(l.campaign_name || 'padrao')}, ${escapeSql(l.full_url || 'https://tanamaodasorte.com.br/?afiliado=' + l.affiliate_code)}, ${escapeSql(l.clicks_count || 0)}, ${escapeSql(l.conversions_count || 0)}, ${escapeSql(l.revenue_generated || 0)}, ${escapeSql(l.is_active !== false)}, ${escapeSql(l.created_at || new Date().toISOString())}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

// 6. Mensagens
if (backup.mensagens && backup.mensagens.length > 0) {
  sql += `-- 6. MENSAGENS / COMISSOES (${backup.mensagens.length} registros)\n`;
  for (const m of backup.mensagens) {
    sql += `INSERT INTO public.mensagens (id, usuario_id, destinatario_id, telefone, conteudo, tipo, data_envio, status) VALUES (${escapeSql(m.id)}, ${escapeSql(m.usuario_id)}, ${escapeSql(m.destinatario_id)}, ${escapeSql(m.telefone)}, ${escapeSql(m.conteudo)}, ${escapeSql(m.tipo || 'lembrete')}, ${escapeSql(m.data_envio || new Date().toISOString())}, ${escapeSql(m.status || 'enviado')}) ON CONFLICT (id) DO NOTHING;\n`;
  }
  sql += '\n';
}

fs.writeFileSync('supabase/import_all_data.sql', sql, 'utf8');
console.log('Script gerado com sucesso em supabase/import_all_data.sql');
