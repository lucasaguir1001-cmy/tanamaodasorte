import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Smartphone, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles 
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    deferredAfiliadosPwaPrompt?: BeforeInstallPromptEvent | null;
    triggerAfiliadosPwaInstall?: () => void;
  }
}

export const PwaInstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const [showBanner, setShowBanner] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [installedSuccess, setInstalledSuccess] = useState(false);

  useEffect(() => {
    // 1. Detect if running as installed standalone PWA or previously installed
    const checkInstalled = async () => {
      const isStandaloneMode = 
        window.matchMedia('(display-mode: standalone)').matches ||
        (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
        document.referrer.includes('android-app://') ||
        window.location.search.includes('source=pwa_afiliados');

      if (isStandaloneMode) {
        localStorage.setItem('pwa_afiliados_installed', 'true');
        setIsStandalone(true);
        setShowBanner(false);
        return true;
      }

      // Check persistent installation flag in localStorage
      if (localStorage.getItem('pwa_afiliados_installed') === 'true') {
        setIsStandalone(true);
        setShowBanner(false);
        return true;
      }

      // Check Android / Chrome getInstalledRelatedApps API if available
      if ('getInstalledRelatedApps' in window.navigator) {
        try {
          const relatedApps = await (window.navigator as any).getInstalledRelatedApps();
          if (relatedApps && relatedApps.length > 0) {
            localStorage.setItem('pwa_afiliados_installed', 'true');
            setIsStandalone(true);
            setShowBanner(false);
            return true;
          }
        } catch {
          // ignore
        }
      }

      return false;
    };

    checkInstalled().then((alreadyInstalled) => {
      if (alreadyInstalled) {
        setShowBanner(false);
      }
    });

    // 2. Detect iOS Safari
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIos(isAppleDevice);

    // 3. Listen for Android / Chrome / Edge 'beforeinstallprompt'
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.deferredAfiliadosPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      
      const alreadyInstalled = localStorage.getItem('pwa_afiliados_installed') === 'true';
      const userDismissed = sessionStorage.getItem('pwa_afiliados_banner_dismissed') === 'true';
      if (!alreadyInstalled && !userDismissed) {
        setShowBanner(true);
      }
    };

    // 4. Listen for app installed
    const handleAppInstalled = () => {
      localStorage.setItem('pwa_afiliados_installed', 'true');
      setIsStandalone(true);
      setShowBanner(false);
      setShowGuideModal(false);
      setInstalledSuccess(true);
      window.deferredAfiliadosPwaPrompt = null;
    };

    // 5. Expose global trigger for install button in Header / Menu
    window.triggerAfiliadosPwaInstall = () => {
      if (window.deferredAfiliadosPwaPrompt) {
        window.deferredAfiliadosPwaPrompt.prompt();
        window.deferredAfiliadosPwaPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            localStorage.setItem('pwa_afiliados_installed', 'true');
            setShowBanner(false);
            window.deferredAfiliadosPwaPrompt = null;
          }
        });
      } else {
        setShowGuideModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For iOS users or browsers that don't emit beforeinstallprompt immediately,
    // show install banner after 2.5 seconds only if not installed
    const timer = setTimeout(() => {
      const alreadyInstalled = localStorage.getItem('pwa_afiliados_installed') === 'true';
      const userDismissed = sessionStorage.getItem('pwa_afiliados_banner_dismissed') === 'true';
      if (!alreadyInstalled && !userDismissed) {
        setShowBanner(true);
      }
    }, 2500);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
          localStorage.setItem('pwa_afiliados_installed', 'true');
          setShowBanner(false);
          setDeferredPrompt(null);
          window.deferredAfiliadosPwaPrompt = null;
        }
      });
    } else {
      setShowGuideModal(true);
    }
  };

  const handleDismiss = () => {
    sessionStorage.setItem('pwa_afiliados_banner_dismissed', 'true');
    setShowBanner(false);
  };

  // Se já estiver no app instalado, não renderiza nada
  if (isStandalone) {
    return null;
  }

  return (
    <>
      {/* ========================================================
          FLOATING PROMPT BANNER (FIXED NA BASE DA TELA)
      ======================================================== */}
      {showBanner && (
        <div className="fixed bottom-4 left-3 right-3 sm:left-auto sm:right-6 sm:max-w-md z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className="relative bg-gradient-to-r from-slate-900 via-indigo-950/90 to-slate-900 border-2 border-amber-400/60 rounded-2xl p-4 shadow-2xl shadow-indigo-950/80 backdrop-blur-md">
            
            {/* Botão Fechar / Dispensar temporariamente */}
            <button
              onClick={handleDismiss}
              className="absolute -top-2.5 -right-2.5 w-7 h-7 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-full flex items-center justify-center border border-slate-700 shadow-md cursor-pointer transition-colors"
              title="Fechar lembrete"
            >
              <X className="w-3.5 h-3.5" />
            </button>

            <div className="flex items-center gap-3.5">
              {/* Ícone Exclusivo Azul/Dourado do App Afiliados */}
              <div className="relative w-14 h-14 rounded-2xl overflow-hidden border border-amber-400/50 shadow-lg shadow-indigo-500/20 shrink-0 bg-slate-950">
                <img
                  src="/afiliados-icon-192.png"
                  alt="App Tá Na Mão da Sorte Afiliados"
                  className="w-full h-full object-cover"
                />
                <span className="absolute bottom-0 inset-x-0 bg-amber-500 text-[8px] font-black text-slate-950 text-center uppercase tracking-tighter">
                  Afiliados
                </span>
              </div>

              {/* Textos de Apelo e Conversão */}
              <div className="flex-1 min-w-0 text-left">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs sm:text-sm font-black text-white truncate">
                    Instalar App Afiliados 🍀
                  </h4>
                  <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[9px] font-extrabold uppercase border border-amber-500/30 shrink-0">
                    Novo
                  </span>
                </div>
                <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-snug">
                  Acompanhe cliques, vendas e comissões no Pix direto da tela do seu celular com 1 toque!
                </p>
              </div>
            </div>

            {/* Botões de Ação */}
            <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-slate-800/80">
              <button
                onClick={handleDismiss}
                className="px-3 py-2 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                Agora não
              </button>

              <button
                onClick={handleInstallClick}
                className="flex-1 flex items-center justify-center gap-2 py-2 px-3.5 bg-gradient-to-r from-amber-400 via-yellow-500 to-amber-500 hover:from-amber-300 hover:to-yellow-400 text-slate-950 font-black text-xs rounded-xl shadow-md shadow-amber-500/25 active:scale-95 transition-all cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Instalar Aplicativo</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* ========================================================
          MODAL DE GUIA MANUAL (PARA IOS SAFARI E BROWSERS SEM NATIVO)
      ======================================================== */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center">
            
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Ícone do App em Destaque */}
            <div className="w-20 h-20 rounded-2xl overflow-hidden mx-auto mb-4 border-2 border-amber-400 shadow-xl shadow-amber-500/20 bg-slate-950">
              <img
                src="/afiliados-icon-192.png"
                alt="Ícone do App Afiliados"
                className="w-full h-full object-cover"
              />
            </div>

            <h3 className="text-lg font-black text-white mb-1">
              Como Instalar no seu Celular
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Adicione o <strong>Tá Na Mão Afiliados</strong> à tela de início sem precisar da Google Play ou App Store.
            </p>

            {isIos ? (
              /* Guia iPhone / iPad */
              <div className="space-y-3 text-left text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <p className="text-slate-300">
                    Toque no botão de <strong>Compartilhar</strong> <Share className="w-3.5 h-3.5 inline mx-1 text-cyan-400" /> na barra inferior do Safari.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <p className="text-slate-300">
                    Role a lista e clique em <strong>"Adicionar à Tela de Início"</strong> <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-emerald-400" />.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <p className="text-slate-300">
                    Confirme tocando em <strong>"Adicionar"</strong> no canto superior direito. Pronto!
                  </p>
                </div>
              </div>
            ) : (
              /* Guia Android / Chrome */
              <div className="space-y-3 text-left text-xs bg-slate-950 p-4 rounded-2xl border border-slate-800 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    1
                  </div>
                  <p className="text-slate-300">
                    Abra o menu de <strong>três pontinhos ⋮</strong> no canto superior do seu navegador Chrome.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    2
                  </div>
                  <p className="text-slate-300">
                    Toque em <strong>"Instalar aplicativo"</strong> ou <strong>"Adicionar à tela inicial"</strong>.
                  </p>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 font-bold text-xs">
                    3
                  </div>
                  <p className="text-slate-300">
                    Confirme a instalação para abrir o painel em tela cheia sempre que quiser.
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={() => {
                setShowGuideModal(false);
                sessionStorage.setItem('pwa_afiliados_banner_dismissed', 'true');
              }}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs rounded-xl transition-colors cursor-pointer"
            >
              Entendi, fechar
            </button>

          </div>
        </div>
      )}

      {/* ========================================================
          FEEDBACK TOAST QUANDO INSTALADO COM SUCESSO
      ======================================================== */}
      {installedSuccess && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-emerald-950/90 border border-emerald-500 rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />
          <div className="text-left text-xs">
            <span className="font-bold text-white block">App de Afiliados Instalado!</span>
            <span className="text-emerald-300">O ícone azul e dourado já está disponível na tela inicial do seu celular.</span>
          </div>
        </div>
      )}
    </>
  );
};
