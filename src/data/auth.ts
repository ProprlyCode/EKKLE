import { supabase } from '@/lib/supabase';
import { env } from '@/lib/env';

/** Auth actions (magic link). Kept out of components like the rest of src/data. */

export async function sendMagicLink(email: string): Promise<void> {
  const redirectTo = env.siteUrl || window.location.origin;
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { emailRedirectTo: `${redirectTo}/app` },
  });
  if (error) throw error;
}

/** Email + password sign-in (admins). Members use the magic link above. */
export async function signInWithPassword(
  email: string,
  password: string,
): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
}
