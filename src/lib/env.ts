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
  /** Public site origin, used to build shareable /r/:slug links and QR codes. */
  siteUrl: string;
}

function readEnv(): AppEnv {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';
  const siteUrl =
    import.meta.env.VITE_SITE_URL ??
    (typeof window !== 'undefined' ? window.location.origin : '');

  return { supabaseUrl, supabaseAnonKey, siteUrl };
}

export const env = readEnv();

/** True when Supabase credentials are present. Lets the UI degrade gracefully. */
export const isSupabaseConfigured = Boolean(
  env.supabaseUrl && env.supabaseAnonKey,
);
