import { useState } from 'react';

/** Open or closed, remembered on this device under `storageKey` (if given). */
function readOpen(key: string | undefined, fallback: boolean): boolean {
  if (!key) return fallback;
  try {
    const v = localStorage.getItem(`ekkle.open.${key}`);
    return v === null ? fallback : v === '1';
  } catch {
    return fallback;
  }
}

export function useOpen(storageKey: string | undefined, defaultOpen: boolean) {
  const [open, setOpen] = useState(() => readOpen(storageKey, defaultOpen));
  function toggle() {
    setOpen((o) => {
      const next = !o;
      if (storageKey) {
        try {
          localStorage.setItem(`ekkle.open.${storageKey}`, next ? '1' : '0');
        } catch {
          /* storage blocked — it just won't be remembered */
        }
      }
      return next;
    });
  }
  return [open, toggle] as const;
}
