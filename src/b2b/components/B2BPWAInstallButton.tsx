import React, { useState } from 'react';
import { Download, Smartphone, CheckCircle, X, Share } from 'lucide-react';
import { useB2BPWA } from '../hooks/useB2BPWA';

interface B2BPWAInstallButtonProps {
  variant?: 'header' | 'badge' | 'full';
  className?: string;
}

export default function B2BPWAInstallButton({ variant = 'header', className = '' }: B2BPWAInstallButtonProps) {
  const { isInstallable, isInstalled, promptInstall } = useB2BPWA();
  const [showGuideModal, setShowGuideModal] = useState(false);

  const handleInstallClick = async () => {
    if (isInstallable) {
      const installed = await promptInstall();
      if (!installed) {
        setShowGuideModal(true);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  if (isInstalled) {
    return (
      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold select-none ${className}`}>
        <CheckCircle className="w-3.5 h-3.5" />
        <span>B2B App Installed</span>
      </div>
    );
  }

  return (
    <>
      {variant === 'badge' ? (
        <button
          onClick={handleInstallClick}
          type="button"
          className={`flex items-center gap-2 px-3 py-1.5 text-xs font-bold rounded-lg bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md hover:shadow-indigo-500/20 transition-all ${className}`}
        >
          <Download className="w-3.5 h-3.5 animate-bounce" />
          <span>Install B2B App</span>
        </button>
      ) : variant === 'full' ? (
        <div className={`p-4 rounded-2xl bg-gradient-to-br from-indigo-900/40 via-slate-800 to-slate-900 border border-indigo-500/30 text-white shadow-xl ${className}`}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-indigo-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">UsePay B2B Portal App</h4>
                <p className="text-xs text-slate-400">Install standalone app on mobile or desktop</p>
              </div>
            </div>
            <button
              onClick={handleInstallClick}
              type="button"
              className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/30 transition-all"
            >
              <Download className="w-4 h-4" />
              <span>Install App</span>
            </button>
          </div>
        </div>
      ) : (
        /* Header variant */
        <button
          onClick={handleInstallClick}
          type="button"
          title="Install UsePay B2B App"
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:text-indigo-300 text-xs font-medium transition-all ${className}`}
        >
          <Smartphone className="w-3.5 h-3.5 text-indigo-400" />
          <span className="hidden sm:inline">Install B2B App</span>
          <Download className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Manual Installation Guide Modal (for iOS or browsers without direct prompt trigger) */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 text-slate-200 shadow-2xl">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-indigo-400">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">How to Install B2B App</h3>
                <p className="text-xs text-slate-400">Follow these simple steps for your device</p>
              </div>
            </div>

            <div className="space-y-3 text-xs text-slate-300 bg-slate-800/60 p-4 rounded-xl border border-slate-700/60">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">1</span>
                <p><strong className="text-white">Android / Chrome:</strong> Tap browser menu <span className="text-indigo-300 font-bold">⋮</span> and select <span className="text-indigo-300 font-bold">"Add to Home Screen"</span> or <span className="text-indigo-300 font-bold">"Install app"</span>.</p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">2</span>
                <p><strong className="text-white">iPhone / Safari:</strong> Tap Share button <Share className="w-3.5 h-3.5 inline text-indigo-400" /> and choose <span className="text-indigo-300 font-bold">"Add to Home Screen"</span>.</p>
              </div>

              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-indigo-600 text-white font-bold text-[10px] flex items-center justify-center shrink-0">3</span>
                <p><strong className="text-white">Desktop (Chrome/Edge):</strong> Click install icon <Download className="w-3.5 h-3.5 inline text-indigo-400" /> in browser address bar.</p>
              </div>
            </div>

            <button
              onClick={() => setShowGuideModal(false)}
              className="w-full mt-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}
