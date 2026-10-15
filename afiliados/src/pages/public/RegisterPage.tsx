import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Header } from '../../components/layout/Header';
import { Footer } from '../../components/layout/Footer';
import { Input } from '../../components/common/Input';
import { Button } from '../../components/common/Button';
import {
  validateCPF,
  validateCNPJ,
  validateEmail,
  validatePhone,
  validateAgeOver18,
  validatePixKey
} from '../../utils/validators';
import { maskCPF, maskCNPJ, maskPhone } from '../../utils/formatters';
import { PixKeyType } from '../../types';
import { CheckCircle2, ShieldAlert, Sparkles, Eye, EyeOff } from 'lucide-react';

const BRAZILIAN_STATES = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA',
  'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN',
  'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];

export const RegisterPage: React.FC = () => {
  const { register } = useAuth();
  const navigate = useNavigate();

  // Form State
  const [fullName, setFullName] = useState('');
  const [documentType, setDocumentType] = useState<'CPF' | 'CNPJ'>('CPF');
  const [documentNumber, setDocumentNumber] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('SP');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Pix info
  const [pixKeyType, setPixKeyType] = useState<PixKeyType>('CPF');
  const [pixKey, setPixKey] = useState('');

  // Promotion channels
  const [socialChannels, setSocialChannels] = useState('');
  const [promotionStrategy, setPromotionStrategy] = useState('');

  // Legal checks
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [acceptPrivacy, setAcceptPrivacy] = useState(false);

  // Status & Feedback
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [registeredCode, setRegisteredCode] = useState('');

  // Sponsor / Network parameters from URL (?sponsor=...&rate=...)
  const [sponsorCode, setSponsorCode] = useState<string | null>(null);
  const [sponsorRate, setSponsorRate] = useState<number | null>(null);

  React.useEffect(() => {
    try {
      const search = new URLSearchParams(window.location.search);
      const sp = search.get('sponsor') || search.get('ref');
      const rt = search.get('rate');
      if (sp) setSponsorCode(sp.trim().toUpperCase());
      if (rt) {
        const parsed = Number(rt);
        if (!isNaN(parsed) && parsed > 0) {
          setSponsorRate(parsed);
        }
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto mask document
  const handleDocChange = (val: string) => {
    if (documentType === 'CPF') {
      setDocumentNumber(maskCPF(val));
    } else {
      setDocumentNumber(maskCNPJ(val));
    }
  };

  const handlePhoneChange = (val: string) => setPhone(maskPhone(val));
  const handleWhatsappChange = (val: string) => setWhatsapp(maskPhone(val));

  const validateForm = () => {
    const errs: Record<string, string> = {};

    if (!fullName.trim() || fullName.trim().split(' ').length < 2) {
      errs.fullName = 'Informe seu nome completo (nome e sobrenome).';
    }

    if (documentType === 'CPF' && !validateCPF(documentNumber)) {
      errs.documentNumber = 'CPF inválido. Verifique os dígitos informados.';
    } else if (documentType === 'CNPJ' && !validateCNPJ(documentNumber)) {
      errs.documentNumber = 'CNPJ inválido. Verifique os números informados.';
    }

    if (!validateEmail(email)) {
      errs.email = 'Informe um endereço de e-mail válido.';
    }

    if (!validatePhone(phone)) {
      errs.phone = 'Informe um telefone de contato válido com DDD.';
    }

    if (!validatePhone(whatsapp)) {
      errs.whatsapp = 'Informe um número de WhatsApp válido com DDD.';
    }

    if (birthDate && !validateAgeOver18(birthDate)) {
      errs.birthDate = 'Você deve ter pelo menos 18 anos para participar do programa.';
    }

    if (!city.trim()) {
      errs.city = 'Informe sua cidade.';
    }

    if (password.length < 8) {
      errs.password = 'A senha deve ter no mínimo 8 caracteres.';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(password)) {
      errs.password = 'A senha deve conter letras maiúsculas, minúsculas e números.';
    }

    if (password !== confirmPassword) {
      errs.confirmPassword = 'As senhas digitadas não coincidem.';
    }

    if (!validatePixKey(pixKey, pixKeyType)) {
      errs.pixKey = `A chave Pix informada não é válida para o tipo ${pixKeyType}.`;
    }

    if (!socialChannels.trim()) {
      errs.socialChannels = 'Informe seus principais canais de divulgação (ex: @instagram, canal do Telegram, etc).';
    }

    if (!promotionStrategy.trim()) {
      errs.promotionStrategy = 'Descreva brevemente como você planeja divulgar o site.';
    }

    if (!acceptTerms) {
      errs.acceptTerms = 'Você deve aceitar os Termos de Uso do programa.';
    }

    if (!acceptPrivacy) {
      errs.acceptPrivacy = 'Você deve aceitar a Política de Privacidade e consentimento LGPD.';
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    const nowIso = new Date().toISOString();

    const payload = {
      fullName: fullName.trim(),
      email: email.trim().toLowerCase(),
      password,
      documentType,
      documentNumber: documentNumber.replace(/\D/g, ''),
      phone: phone.replace(/\D/g, ''),
      whatsapp: whatsapp.replace(/\D/g, ''),
      birthDate,
      city: city.trim(),
      state,
      pixKeyType,
      pixKey: pixKey.trim(),
      socialChannels: socialChannels.trim(),
      promotionStrategy: promotionStrategy.trim(),
      parentAffiliateCode: sponsorCode || undefined,
      commissionRate: sponsorRate ? sponsorRate / 100 : undefined,
      termsAcceptedAt: nowIso,
      privacyAcceptedAt: nowIso
    };

    const result = await register(payload);
    setIsLoading(false);

    if (result.success && result.affiliate) {
      setRegisteredCode(result.affiliate.exclusiveCode);
      setIsSuccess(true);
    } else {
      setErrors({ form: result.error || 'Ocorreu um erro ao processar o cadastro. Tente novamente.' });
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
        <Header />
        <main className="flex-1 max-w-xl mx-auto px-4 py-16 flex items-center justify-center">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl p-8 sm:p-10 text-center shadow-2xl shadow-emerald-950/60">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto mb-6 border border-emerald-500/30">
              <CheckCircle2 className="w-10 h-10" />
            </div>

            <span className="inline-block px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black uppercase tracking-wider mb-2">
              Cadastro Enviado com Sucesso! 🍀
            </span>

            <h2 className="text-2xl sm:text-3xl font-black text-white mb-3">
              Bem-vindo ao Tá na Mão da Sorte
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed mb-6">
              Olá, <strong className="text-white">{fullName}</strong>! Recebemos sua inscrição. Seu código provisório de afiliado gerado é:
            </p>

            <div className="p-4 bg-slate-950 rounded-2xl border border-emerald-500/40 mb-6">
              <span className="text-xs text-slate-400 block mb-1">Seu Código Exclusivo</span>
              <span className="text-2xl font-mono font-black text-amber-400 tracking-wider">
                {registeredCode}
              </span>
            </div>

            <div className="p-4 bg-slate-950/70 rounded-2xl border border-slate-800 text-left text-xs text-slate-400 space-y-2 mb-8">
              <p className="flex items-start gap-2">
                <span className="text-amber-400">⏳</span>
                <span><strong>Status:</strong> Em análise pela equipe de segurança (geralmente concluída em até 24 horas).</span>
              </p>
              <p className="flex items-start gap-2">
                <span className="text-emerald-400">📩</span>
                <span>Enviaremos uma notificação no seu e-mail <strong>{email}</strong> assim que sua conta estiver aprovada.</span>
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <Link to="/afiliados/login" className="flex-1">
                <Button size="lg" className="w-full">
                  Fazer Login no Portal
                </Button>
              </Link>
              <Link to="/afiliados" className="flex-1">
                <Button variant="secondary" size="lg" className="w-full">
                  Voltar ao Início
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100">
      <Header />

      <main className="flex-1 py-12 px-4 sm:px-6 lg:px-8 max-w-3xl mx-auto w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold mb-3">
            <Sparkles className="w-3.5 h-3.5" /> Cadastro Gratuito de Afiliado
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-white">
            Torne-se um Afiliado Oficial
          </h1>
          <p className="text-sm text-slate-400 mt-2">
            Preencha seus dados reais para faturamento e recebimento de comissões via Pix.
          </p>
        </div>

        {errors.form && (
          <div className="mb-6 p-4 bg-red-950/60 border border-red-500/40 rounded-2xl flex items-center gap-3 text-red-300 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-400" />
            <span>{errors.form}</span>
          </div>
        )}

        {sponsorCode && (
          <div className="mb-6 p-4 sm:p-5 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-emerald-950/40 border border-emerald-500/50 rounded-2xl flex items-center justify-between gap-4 shadow-lg shadow-emerald-950/50">
            <div className="flex items-center gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-green-700 flex items-center justify-center text-xl shrink-0 shadow-md">
                🍀
              </div>
              <div>
                <span className="font-bold text-white text-sm block">
                  Convite de Afiliado Parceiro
                </span>
                <p className="text-xs text-slate-300 mt-0.5">
                  Você foi indicado pelo patrocinador <strong className="text-amber-400 font-mono font-bold">{sponsorCode}</strong>
                  {sponsorRate ? (
                    <> com comissão garantida de <strong className="text-emerald-400 font-bold">{sponsorRate}%</strong> por cada bilhete vendido!</>
                  ) : (
                    <> para fazer parte da equipe oficial!</>
                  )}
                </p>
              </div>
            </div>
            <div className="hidden sm:block shrink-0">
              <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-lg text-xs font-bold whitespace-nowrap">
                Vínculo Direto
              </span>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 shadow-2xl space-y-8">
          
          {/* 1. DADOS PESSOAIS */}
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 pb-2 border-b border-slate-800 mb-4">
              <span className="w-6 h-6 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center text-xs">1</span>
              Dados Pessoais ou da Empresa
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <Input
                  label="Nome Completo / Razão Social"
                  placeholder="Ex: Lucas Oliveira da Silva"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  error={errors.fullName}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tipo de Documento <span className="text-emerald-400">*</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => { setDocumentType('CPF'); setDocumentNumber(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      documentType === 'CPF'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    CPF (Pessoa Física)
                  </button>
                  <button
                    type="button"
                    onClick={() => { setDocumentType('CNPJ'); setDocumentNumber(''); }}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                      documentType === 'CNPJ'
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-white'
                    }`}
                  >
                    CNPJ (Pessoa Jurídica)
                  </button>
                </div>
              </div>

              <div>
                <Input
                  label={documentType === 'CPF' ? 'Número do CPF' : 'Número do CNPJ'}
                  placeholder={documentType === 'CPF' ? '000.000.000-00' : '00.000.000/0000-00'}
                  value={documentNumber}
                  onChange={(e) => handleDocChange(e.target.value)}
                  error={errors.documentNumber}
                  required
                />
              </div>

              <div>
                <Input
                  label="Data de Nascimento"
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  error={errors.birthDate}
                  helperText="Obrigatório ser maior de 18 anos."
                  required
                />
              </div>

              <div>
                <Input
                  label="E-mail"
                  type="email"
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                  required
                />
              </div>

              <div>
                <Input
                  label="Telefone de Contato"
                  placeholder="(00) 0000-0000"
                  value={phone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                  error={errors.phone}
                  required
                />
              </div>

              <div>
                <Input
                  label="WhatsApp Oficial"
                  placeholder="(00) 90000-0000"
                  value={whatsapp}
                  onChange={(e) => handleWhatsappChange(e.target.value)}
                  error={errors.whatsapp}
                  helperText="Para confirmações e contato com o suporte."
                  required
                />
              </div>

              <div>
                <Input
                  label="Cidade"
                  placeholder="Ex: São Paulo"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  error={errors.city}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Estado (UF) <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="w-full bg-slate-950 border border-emerald-900/60 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  {BRAZILIAN_STATES.map((uf) => (
                    <option key={uf} value={uf}>{uf}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2. CHAVE PIX */}
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 pb-2 border-b border-slate-800 mb-4">
              <span className="w-6 h-6 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs">2</span>
              Dados de Pagamento via Pix
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Tipo da Chave Pix <span className="text-emerald-400">*</span>
                </label>
                <select
                  value={pixKeyType}
                  onChange={(e) => {
                    setPixKeyType(e.target.value as PixKeyType);
                    setPixKey('');
                  }}
                  className="w-full bg-slate-950 border border-emerald-900/60 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-400"
                >
                  <option value="CPF">CPF</option>
                  <option value="CNPJ">CNPJ</option>
                  <option value="EMAIL">E-mail</option>
                  <option value="PHONE">Telefone / Celular</option>
                  <option value="RANDOM">Chave Aleatória (EVP)</option>
                </select>
              </div>

              <div>
                <Input
                  label="Chave Pix"
                  placeholder={
                    pixKeyType === 'CPF' ? 'Digite seu CPF' :
                    pixKeyType === 'CNPJ' ? 'Digite seu CNPJ' :
                    pixKeyType === 'EMAIL' ? 'seuemail@pix.com' :
                    pixKeyType === 'PHONE' ? '(00) 90000-0000' :
                    'Código da chave aleatória'
                  }
                  value={pixKey}
                  onChange={(e) => setPixKey(e.target.value)}
                  error={errors.pixKey}
                  required
                />
              </div>
            </div>
          </div>

          {/* 3. CANAIS DE DIVULGAÇÃO */}
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 pb-2 border-b border-slate-800 mb-4">
              <span className="w-6 h-6 rounded-lg bg-cyan-500/20 text-cyan-400 flex items-center justify-center text-xs">3</span>
              Perfil e Estratégia de Divulgação
            </h3>

            <div className="space-y-4">
              <div>
                <Input
                  label="Canais de Divulgação (Instagram, TikTok, YouTube, Grupos)"
                  placeholder="Ex: @meuperfil (25k), Grupo VIP de palpites no WhatsApp (800 membros)"
                  value={socialChannels}
                  onChange={(e) => setSocialChannels(e.target.value)}
                  error={errors.socialChannels}
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Como você pretende divulgar o Tá na Mão da Sorte? <span className="text-emerald-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={promotionStrategy}
                  onChange={(e) => setPromotionStrategy(e.target.value)}
                  placeholder="Ex: Postagens diárias nos Stories antes das 19h com os números premiados e indicação direta em grupos de amigos."
                  className="w-full bg-slate-950 border border-emerald-900/60 rounded-xl p-3 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-400"
                />
                {errors.promotionStrategy && (
                  <p className="text-xs text-red-400 mt-1 font-medium">{errors.promotionStrategy}</p>
                )}
              </div>
            </div>
          </div>

          {/* 4. SEGURANÇA E ACESSO */}
          <div>
            <h3 className="text-base font-extrabold text-white flex items-center gap-2 pb-2 border-b border-slate-800 mb-4">
              <span className="w-6 h-6 rounded-lg bg-slate-800 text-slate-300 flex items-center justify-center text-xs">4</span>
              Senha de Acesso
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Senha de Acesso"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  required
                />
              </div>

              <div>
                <Input
                  label="Confirmar Senha"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repita sua senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  error={errors.confirmPassword}
                  required
                />
              </div>
            </div>
          </div>

          {/* 5. TERMOS E LGPD */}
          <div className="space-y-3 pt-4 border-t border-slate-800">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptTerms}
                onChange={(e) => setAcceptTerms(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                Declaro que tenho mais de 18 anos de idade e aceito integralmente os{' '}
                <span className="text-emerald-400 font-bold underline">Termos e Condições do Programa de Afiliados</span>{' '}
                do Tá na Mão da Sorte, ciente de que práticas como spam ou auto-compra resultarão na desativação da conta.
              </span>
            </label>
            {errors.acceptTerms && <p className="text-xs text-red-400 font-medium pl-7">{errors.acceptTerms}</p>}

            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptPrivacy}
                onChange={(e) => setAcceptPrivacy(e.target.checked)}
                className="mt-1 w-4 h-4 rounded accent-emerald-500 bg-slate-950 border-slate-700 cursor-pointer"
              />
              <span className="text-xs text-slate-300 leading-relaxed">
                Concordo com o tratamento dos meus dados pessoais em conformidade com a{' '}
                <span className="text-emerald-400 font-bold underline">Política de Privacidade (LGPD)</span>{' '}
                para fins de identificação, auditoria fiscal e liquidação de comissões via Pix.
              </span>
            </label>
            {errors.acceptPrivacy && <p className="text-xs text-red-400 font-medium pl-7">{errors.acceptPrivacy}</p>}
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-4">
            <Button
              type="submit"
              size="lg"
              isLoading={isLoading}
              className="w-full text-base py-4"
            >
              Concluir Meu Cadastro de Afiliado 🍀
            </Button>

            <p className="text-center text-xs text-slate-400 mt-4">
              Já possui uma conta de parceiro?{' '}
              <Link to="/afiliados/login" className="text-emerald-400 font-bold hover:underline">
                Faça Login Aqui
              </Link>
            </p>
          </div>
        </form>
      </main>

      <Footer />
    </div>
  );
};
