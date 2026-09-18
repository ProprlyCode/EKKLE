import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';
import { env } from './env';

/**
 * Single Supabase browser client (anon key, RLS-enforced).
 *
 * Components never import this directly — they go through the data-access layer
 * in src/data/*. That indirection keeps query logic in one place and makes the
 * backend swappable later.
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);
