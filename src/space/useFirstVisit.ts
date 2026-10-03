import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/**
 * Is this their first time in Your space (0051)? Asked once per browser
 * session and remembered for it, so the whole first visit says "Welcome" and
 * later visits say "Welcome back". Null until known (or if it can't be).
 */
const KEY = 'ekkle.space.first-visit';

export function useFirstVisit(): boolean | null {
  const [first, setFirst] = useState<boolean | null>(() => {
    try {
      const v = sessionStorage.getItem(KEY);
      return v === null ? null : v === '1';
    } catch {
      return null;
    }
  });

  useEffect(() => {
    if (first !== null) return;
    let live = true;
    supabase.rpc('space_visit').then(({ data, error }) => {
      if (!live || error || data === null || data === undefined) return;
      try {
        sessionStorage.setItem(KEY, data ? '1' : '0');
      } catch {
        /* storage blocked: asked again next page, which then says "back" */
      }
      setFirst(Boolean(data));
    });
    return () => {
      live = false;
    };
  }, [first]);

  return first;
}

/** "Welcome" on a first visit (or when unknown), "Welcome back" after. */
export const greeting = (first: boolean | null) => (first === false ? 'Welcome back' : 'Welcome');
