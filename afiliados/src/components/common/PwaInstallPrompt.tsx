import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles,
  Smartphone
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    deferredAfiliadosPwaPrompt?: BeforeInstallPromptEvent | null;
  }
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showAutoModal, setShowAutoModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Função estrita de detecção de app já instalado
    const checkIsInstalled = async (): Promise<boolean> => {
      if (typeof window === 'undefined') return false;

      // Standalone display mode (Chrome / Edge / Android / Samsung)
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        window.matchMedia('(display-mode: fullscreen)').matches ||
        window.matchMedia('(display-mode: minimal-ui)').matches;

      // iOS Safari Standalone mode
      const isIosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;

      // Android TWA / PWA referrers ou parâmetro de inicialização da PWA
      const isReferrerPwa = 
        document.referrer.includes('android-app://') ||
        window.location.search.includes('source=pwa') ||
        window.location.search.includes('source=pwa_afiliados');

      // Flags persistentes no localStorage e Cookie
      const isStorageInstalled = localStorage.getItem('pwa_afiliados_installed') === 'true';
      const isCookieInstalled = document.cookie.includes('pwa_afiliados_installed=true');

      if (isStandaloneMode || isIosStandalone || isReferrerPwa || isStorageInstalled || isCookieInstalled) {
        localStorage.setItem('pwa_afiliados_installed', 'true');
        document.cookie = 'pwa_afiliados_installed=true; max-age=31536000; path=/afiliados';
        setIsInstalled(true);
        setShowAutoModal(false);
        return true;
      }

      // API getInstalledRelatedApps do Android / Chrome
      if ('getInstalledRelatedApps' in window.navigator) {
        try {
          const relatedApps = await (window.navigator as any).getInstalledRelatedApps();
          if (relatedApps && relatedApps.length > 0) {
            localStorage.setItem('pwa_afiliados_installed', 'true');
            document.cookie = 'pwa_afiliados_installed=true; max-age=31536000; path=/afiliados';
            setIsInstalled(true);
            setShowAutoModal(false);
            return true;
          }
        } catch {}
      }

      return false;
    };

    // Executa checagem imediata
    checkIsInstalled().then((alreadyInstalled) => {
      if (alreadyInstalled) return;

      // 2. Detecção de dispositivo Apple iOS (iPhone/iPad)
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isApple = /iphone|ipad|ipod/.test(userAgent);
      setIsIos(isApple);

      // Se for iOS e não estiver instalado nem dispensado nesta sessão, exibe o guia automático
      if (isApple) {
        const sessionDismissed = sessionStorage.getItem('pwa_afiliados_auto_dismissed') === 'true';
        if (!sessionDismissed) {
          const iosTimer = setTimeout(() => {
            setShowAutoModal(true);
          }, 1200);
          return () => clearTimeout(iosTimer);
        }
      }
    });

    // 3. Captura o evento nativo 'beforeinstallprompt' (Android / Chrome / Edge)
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.deferredAfiliadosPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);

      const alreadyInstalled = 
        localStorage.getItem('pwa_afiliados_installed') === 'true' ||
        document.cookie.includes('pwa_afiliados_installed=true');

      if (alreadyInstalled) {
        setIsInstalled(true);
        return;
      }

      const sessionDismissed = sessionStorage.getItem('pwa_afiliados_auto_dismissed') === 'true';
      if (!sessionDismissed) {
        // Exibe o diálogo automático de instalação após 800ms
        const timer = setTimeout(() => {
          setShowAutoModal(true);
        }, 800);

        // Ativa gatilho no primeiro clique/toque caso o navegador exija gesto do usuário
        const handleOneTimeGesture = () => {
          window.removeEventListener('pointerdown', handleOneTimeGesture);
          window.removeEventListener('click', handleOneTimeGesture);
        };
        window.addEventListener('pointerdown', handleOneTimeGesture, { once: true });
        window.addEventListener('click', handleOneTimeGesture, { once: true });

        return () => clearTimeout(timer);
      }
    };

    // 4. Captura confirmação de instalação concluída
    const handleAppInstalled = () => {
      localStorage.setItem('pwa_afiliados_installed', 'true');
      document.cookie = 'pwa_afiliados_installed=true; max-age=31536000; path=/afiliados';
      setIsInstalled(true);
      setShowAutoModal(false);
      setInstalledSuccess(true);
      window.deferredAfiliadosPwaPrompt = null;
      setDeferredPrompt(null);
      setTimeout(() => setInstalledSuccess(false), 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  // Manipulador do botão de confirmação do diálogo automático
  const handleConfirmInstall = async () => {
    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === 'accepted') {
          localStorage.setItem('pwa_afiliados_installed', 'true');
          document.cookie = 'pwa_afiliados_installed=true; max-age=31536000; path=/afiliados';
          setIsInstalled(true);
          setShowAutoModal(false);
          setInstalledSuccess(true);
          window.deferredAfiliadosPwaPrompt = null;
          setDeferredPrompt(null);
          setTimeout(() => setInstalledSuccess(false), 5000);
          return;
        }
      } catch (err) {
        console.warn('Erro ao disparar prompt de instalação:', err);
      }
    }
  };

  // Dispensar aviso nesta sessão
  const handleDismiss = () => {
    sessionStorage.setItem('pwa_afiliados_auto_dismissed', 'true');
    setShowAutoModal(false);
  };

  // SE JÁ ESTIVER INSTALADO: Não renderiza absolutamente NADA!
  if (isInstalled) {
    return null;
  }

  return (
    <>
      {/* ========================================================
          MODAL AUTOMÁTICO DE INSTALAÇÃO AO ACESSAR O LINK
          (Aparece diretamente ao abrir, sem botões flutuantes fixos na tela)
      ======================================================== */}
      {showAutoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-300">
          <div className="relative w-full max-w-sm bg-gradient-to-b from-slate-900 via-slate-900 to-indigo-950/90 border-2 border-amber-400/60 rounded-3xl p-6 shadow-2xl shadow-indigo-950/90 text-center animate-in zoom-in-95 duration-200">
            
            {/* Fechar / Dispensar */}
            <button
              onClick={handleDismiss}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-full bg-slate-800/80 border border-slate-700/80 cursor-pointer transition-colors"
              title="Fechar"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Ícone Exclusivo Azul/Dourado do App Afiliados */}
            <div className="relative w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 border-2 border-amber-400 shadow-xl shadow-indigo-500/30 bg-slate-950">
              <img
                src="/afiliados-icon-192.png"
                alt="App Tá Na Mão da Sorte Afiliados"
                className="w-full h-full object-cover"
              />
              <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[8px] font-black text-slate-950 text-center uppercase tracking-tighter py-0.5">
                Afiliados
              </span>
            </div>

            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[10px] font-black uppercase tracking-wider mb-2">
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span>Aplicativo Oficial</span>
            </div>

            <h3 className="text-lg font-black text-white mb-1.5 leading-snug">
              Instalar App Afiliados 🍀
            </h3>
            
            <p className="text-xs text-slate-300 mb-5 leading-relaxed">
              Deseja adicionar o <strong>Tá Na Mão Afiliados</strong> à sua tela inicial? Acompanhe cliques, vendas da sua rede e saques Pix com 1 toque!
            </p>

            {isIos ? (
              /* Guia Passo a Passo no iPhone / iPad */
              <div className="space-y-2.5 text-left text-xs bg-slate-950/90 p-4 rounded-2xl border border-slate-800 mb-5">
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    1
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Toque em <strong>Compartilhar</strong> <Share className="w-3 h-3 inline mx-0.5 text-cyan-400" /> na barra inferior do Safari.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    2
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Role e toque em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare className="w-3 h-3 inline mx-0.5 text-emerald-400" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-[11px]">
                    3
                  </div>
                  <p className="text-slate-300 text-[11px]">
                    Toque em <strong>"Adicionar"</strong> no canto superior. Pronto!
                  </p>
                </div>
              </div>
            ) : null}

            {/* Ações */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDismiss}
                className="w-1/3 py-2.5 px-3 text-xs font-bold text-slate-400 hover:text-white bg-slate-800/80 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
              >
                Agora não
              </button>

              <button
                onClick={isIos ? handleDismiss : handleConfirmInstall}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-lg shadow-amber-500/30 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>{isIos ? 'Entendido!' : 'Instalar Agora'}</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          FEEDBACK TOAST QUANDO INSTALADO COM SUCESSO
      ======================================================== */}
      {installedSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/95 border border-emerald-500 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="text-left text-xs">
            <span className="font-bold text-white block">App de Afiliados Instalado!</span>
            <span className="text-emerald-300">O ícone já está disponível na tela inicial do seu celular.</span>
          </div>
        </div>
      )}
    </>
  );
};
