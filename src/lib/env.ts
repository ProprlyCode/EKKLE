/**
 * Typed access to the Vite environment variables the client needs.
 *
 * Only VITE_-prefixed vars are exposed to the browser bundle. Anything secret
 * (service-role keys, email provider keys) must live server-side (Supabase Edge
 * Functions), never here.
 */

interface AppEnv {
  supabaseUrl: string;
  supabaseAnonKey: string;
  /**
   * This page's own origin — an account's address (or ekkle.org). Shareable
   * /r/:slug links, QR codes and sign-in links are built from it, so they
   * always point back to the account they belong to.
   */
  siteUrl: string;
}

function readEnv(): AppEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const siteUrl = typeof window !== 'undefined' ? window.location.origin : '';

  return { supabaseUrl, supabaseAnonKey, siteUrl };
}

export const env = readEnv();

/** True when Supabase credentials are present. Lets the UI degrade gracefully. */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);
