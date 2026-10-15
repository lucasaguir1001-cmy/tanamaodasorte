'use client';

import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Smartphone, 
  Share, 
  PlusSquare, 
  CheckCircle2, 
  Sparkles,
  ExternalLink
} from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

declare global {
  interface Window {
    deferredPwaPrompt?: BeforeInstallPromptEvent | null;
    triggerPwaInstall?: () => void;
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
        window.location.search.includes('source=pwa');

      if (isStandaloneMode) {
        localStorage.setItem('pwa_app_installed', 'true');
        setIsStandalone(true);
        setShowBanner(false);
        return true;
      }

      // Check persistent installation flag
      if (localStorage.getItem('pwa_app_installed') === 'true') {
        setIsStandalone(true);
        setShowBanner(false);
        return true;
      }

      // Check Android / Chrome getInstalledRelatedApps API
      if ('getInstalledRelatedApps' in window.navigator) {
        try {
          const relatedApps = await (window.navigator as any).getInstalledRelatedApps();
          if (relatedApps && relatedApps.length > 0) {
            localStorage.setItem('pwa_app_installed', 'true');
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

    // Persistent check for previously dismissed banner
    const isDismissed = 
      localStorage.getItem('pwa_banner_dismissed') === 'true' ||
      localStorage.getItem('pwa_app_installed') === 'true' ||
      sessionStorage.getItem('pwa_banner_dismissed') === 'true';

    // 3. Listen for Android / Chrome / Edge 'beforeinstallprompt'
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const promptEvent = e as BeforeInstallPromptEvent;
      window.deferredPwaPrompt = promptEvent;
      setDeferredPrompt(promptEvent);
      
      const alreadyInstalled = localStorage.getItem('pwa_app_installed') === 'true';
      const userDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';
      if (!alreadyInstalled && !userDismissed) {
        setShowBanner(true);
      }
    };

    // 4. Listen for app installed
    const handleAppInstalled = () => {
      localStorage.setItem('pwa_app_installed', 'true');
      localStorage.setItem('pwa_banner_dismissed', 'true');
      setIsStandalone(true);
      setShowBanner(false);
      setShowGuideModal(false);
      setInstalledSuccess(true);
      window.deferredPwaPrompt = null;
    };

    // 5. Expose global trigger for Header button
    window.triggerPwaInstall = () => {
      if (window.deferredPwaPrompt) {
        window.deferredPwaPrompt.prompt();
        window.deferredPwaPrompt.userChoice.then((choice) => {
          if (choice.outcome === 'accepted') {
            localStorage.setItem('pwa_app_installed', 'true');
            localStorage.setItem('pwa_banner_dismissed', 'true');
            setShowBanner(false);
            window.deferredPwaPrompt = null;
          }
        });
      } else {
        setShowGuideModal(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // For iOS users or browsers that don't emit beforeinstallprompt immediately,
    // show floating banner after 3 seconds only if not installed and not dismissed
    const timer = setTimeout(() => {
      const alreadyInstalled = localStorage.getItem('pwa_app_installed') === 'true';
      const userDismissed = localStorage.getItem('pwa_banner_dismissed') === 'true';
      if (!alreadyInstalled && !userDismissed) {
        setShowBanner(true);
      }
    }, 3000);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      clearTimeout(timer);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        localStorage.setItem('pwa_app_installed', 'true');
        localStorage.setItem('pwa_banner_dismissed', 'true');
        setShowBanner(false);
        setDeferredPrompt(null);
        window.deferredPwaPrompt = null;
      }
    } else {
      // Show modal guidance for iOS or browsers without native prompt
      setShowGuideModal(true);
    }
  };

  const handleDismissBanner = () => {
    setShowBanner(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
    sessionStorage.setItem('pwa_banner_dismissed', 'true');
  };

  const handleCloseGuideModal = () => {
    setShowGuideModal(false);
    localStorage.setItem('pwa_banner_dismissed', 'true');
  };

  // If already installed standalone and modal closed, render nothing
  if ((isStandalone || (typeof window !== 'undefined' && localStorage.getItem('pwa_app_installed') === 'true')) && !showGuideModal) {
    return null;
  }

  return (
    <>
      {/* FLOATING PROMPT BANNER */}
      {showBanner && !isStandalone && (
        <div className="fixed bottom-3 left-3 right-3 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-md z-50 animate-in fade-in slide-in-from-bottom duration-300">
          <div className="bg-slate-900/95 border-2 border-emerald-500/80 rounded-2xl p-4 shadow-2xl shadow-emerald-950/80 backdrop-blur-md flex items-center justify-between gap-3 text-left">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-400 to-green-700 flex items-center justify-center text-white shrink-0 shadow-md shadow-emerald-500/30 border border-emerald-300/40">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-black text-white">Instalar Aplicativo</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.2 bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 rounded">PWA</span>
                </div>
                <p className="text-[11px] text-slate-300 leading-tight mt-0.5">
                  Adicione à tela inicial para acesso rápido, resultados e Pix em 1 toque!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={handleInstallClick}
                className="px-3.5 py-2 bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 text-slate-950 text-xs font-black rounded-xl shadow-lg shadow-emerald-500/30 transition-all transform active:scale-95 cursor-pointer whitespace-nowrap flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Instalar</span>
              </button>

              <button
                onClick={handleDismissBanner}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GUIDANCE MODAL (FOR IOS OR DESKTOP/MANUAL) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-emerald-500/50 rounded-3xl max-w-sm w-full p-6 text-center shadow-2xl relative">
            <button
              onClick={handleCloseGuideModal}
              className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-green-700 mx-auto mb-4 flex items-center justify-center text-3xl shadow-lg shadow-emerald-500/20 border border-emerald-300/40">
              🍀
            </div>

            <h3 className="text-lg font-black text-white mb-1">
              Instalar Tá Na Mão da SORTE
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Tenha o aplicativo direto na sua tela inicial sem precisar abrir o navegador!
            </p>

            {isIos ? (
              // iOS Instructions
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-left space-y-3 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-emerald-500/40">
                    1
                  </div>
                  <p className="text-xs text-slate-300">
                    Toque no botão <strong className="text-white flex items-center gap-1 inline-flex"><Share className="w-3.5 h-3.5 text-cyan-400 inline" /> Compartilhar</strong> na barra inferior do Safari.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-emerald-500/40">
                    2
                  </div>
                  <p className="text-xs text-slate-300">
                    Role a lista para baixo e toque em <strong className="text-white flex items-center gap-1 inline-flex"><PlusSquare className="w-3.5 h-3.5 text-emerald-400 inline" /> Adicionar à Tela de Início</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-emerald-500/40">
                    3
                  </div>
                  <p className="text-xs text-slate-300">
                    Toque em <strong className="text-emerald-400">Adicionar</strong> no canto superior direito para concluir.
                  </p>
                </div>
              </div>
            ) : (
              // Android / Chrome / Edge Instructions
              <div className="bg-slate-950/80 rounded-2xl p-4 border border-slate-800 text-left space-y-3 mb-5">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-emerald-500/40">
                    1
                  </div>
                  <p className="text-xs text-slate-300">
                    Toque no menu de <strong className="text-white">3 pontinhos (⋮)</strong> no canto superior do navegador.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-emerald-500/40">
                    2
                  </div>
                  <p className="text-xs text-slate-300">
                    Selecione a opção <strong className="text-emerald-400">Instalar aplicativo</strong> ou <strong className="text-emerald-400">Adicionar à tela inicial</strong>.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 border border-emerald-500/40">
                    3
                  </div>
                  <p className="text-xs text-slate-300">
                    Confirme em <strong className="text-emerald-400">Instalar</strong>. O ícone oficial será adicionado à sua tela!
                  </p>
                </div>
              </div>
            )}

            <button
              onClick={handleCloseGuideModal}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-sm rounded-xl transition-colors cursor-pointer"
            >
              Entendi!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
