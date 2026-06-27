import { useEffect, useRef } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PwaUpdatePrompt() {
  const shownRef = useRef(false);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });

  useEffect(() => {
    if (!needRefresh || shownRef.current) return;
    shownRef.current = true;
    toast('New version available', {
      description: 'Tap update to load the latest BoredRoom build.',
      duration: 20000,
      action: {
        label: 'Update',
        onClick: () => updateServiceWorker(true),
      },
    });
  }, [needRefresh, updateServiceWorker]);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      const installEvent = event as BeforeInstallPromptEvent;
      toast('Install BoredRoom', {
        description: 'Add it to this device for faster hosting and joining.',
        duration: 15000,
        action: {
          label: 'Install',
          onClick: () => {
            installEvent.prompt().catch(() => {});
          },
        },
      });
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  return null;
}
