import { useState, useEffect } from 'react';

export function useB2BPWA() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Mark B2B as active portal for standalone PWA launch routing
    try {
      localStorage.setItem('lastPortal', 'b2b');
    } catch (e) {}

    // 2. Switch HTML <link rel="manifest"> to B2B Manifest dynamically
    const manifestLink = document.querySelector('link[rel="manifest"]');
    
    if (manifestLink) {
      manifestLink.setAttribute('href', '/b2b-manifest.json');
    }

    // Check if already running in standalone PWA mode
    const isStandalone = 
      window.matchMedia('(display-mode: standalone)').matches || 
      (window.navigator as any).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Listen for browser PWA install event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const promptInstall = async () => {
    if (!deferredPrompt) return false;

    try {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
    } catch (err) {
      console.error('Error prompting B2B PWA install:', err);
    }
    return false;
  };

  return { isInstallable, isInstalled, promptInstall };
}
