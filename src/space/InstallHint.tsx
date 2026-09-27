import { useEffect, useState } from 'react';

/** Chrome/Edge/Android's install prompt event (not in the standard DOM types). */
interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const DISMISS_KEY = 'ekkle.install-hint.dismissed';

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/**
 * "Add Your space to your home screen" — a quiet card on Your space Home.
 * Uses the browser's own install prompt where there is one (Android, Chrome,
 * Edge); on iPhone it explains Share → Add to Home Screen. Hidden once
 * installed or dismissed.
 */
export function InstallHint() {
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);
  const [hidden, setHidden] = useState(() => {
    try {
      return isStandalone() || localStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return isStandalone();
    }
  });

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPromptEvent);
    };
    const onInstalled = () => setHidden(true);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  function dismiss() {
    setHidden(true);
    try {
      localStorage.setItem(DISMISS_KEY, '1');
    } catch {
      /* storage blocked — it just shows again next time */
    }
  }

  if (hidden || (!prompt && !isIos())) return null;

  return (
    <section className="flex items-start gap-4 rounded-card border border-edge bg-card px-5 py-4">
      <img src="/icon-192.png" alt="" width={40} height={40} className="h-10 w-10 shrink-0 rounded-lg" />
      <div className="flex flex-1 flex-col gap-2">
        <p className="text-[15px] font-medium text-sage">Keep Your space on your home screen</p>
        {prompt ? (
          <p className="text-[13px] leading-relaxed text-muted-strong">
            It opens straight here, like an app.
          </p>
        ) : (
          <p className="text-[13px] leading-relaxed text-muted-strong">
            In Safari, tap Share, then “Add to Home Screen”. It opens straight here, like an app.
          </p>
        )}
        <div className="flex items-center gap-4">
          {prompt && (
            <button
              onClick={async () => {
                await prompt.prompt();
                const { outcome } = await prompt.userChoice;
                if (outcome === 'accepted') setHidden(true);
                setPrompt(null);
              }}
              className="rounded-lg bg-sage px-3 py-1.5 text-[13px] font-medium text-canvas hover:bg-sage-soft"
            >
              Add to home screen
            </button>
          )}
          <button onClick={dismiss} className="text-[13px] text-muted hover:text-sage">
            Not now
          </button>
        </div>
      </div>
    </section>
  );
}
