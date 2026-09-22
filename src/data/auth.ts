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

/** Email + password sign-in (admins + seekers who set a password). */
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

const SEEKER_INTAKE_KEY = 'ekkle_seeker_intake';

/**
 * Seeker magic link — used by /offer (new) and the seeker sign-in (returning).
 * Redirects back to /studies, where the account is linked. The first name and
 * any ?ref are stashed locally to apply once they return verified.
 */
export async function sendStudyMagicLink(input: {
  email: string;
  firstName?: string;
  ref?: string | null;
}): Promise<void> {
  const redirectTo = env.siteUrl || window.location.origin;
  try {
    localStorage.setItem(
      SEEKER_INTAKE_KEY,
      JSON.stringify({
        firstName: input.firstName?.trim() ?? '',
        ref: input.ref?.trim() ?? '',
      }),
    );
  } catch {
    /* storage blocked — attribution/name just won't prefill */
  }
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email.trim(),
    options: { emailRedirectTo: `${redirectTo}/studies` },
  });
  if (error) throw error;
}

/** The name/ref captured before a seeker verified, applied on return. */
export function savedSeekerIntake(): { firstName: string; ref: string } {
  try {
    const raw = localStorage.getItem(SEEKER_INTAKE_KEY);
    return raw ? JSON.parse(raw) : { firstName: '', ref: '' };
  } catch {
    return { firstName: '', ref: '' };
  }
}

/** Let a signed-in seeker add a password, enabling classic sign-in later. */
export async function setMyPassword(password: string): Promise<void> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) throw error;
}

/**
 * Email a password-reset link. The link opens /reset-password with a recovery
 * session; `src` steers where they land afterward (admin area vs studies).
 */
export async function sendPasswordReset(
  email: string,
  src: 'admin' | 'seeker',
): Promise<void> {
  const redirectTo = env.siteUrl || window.location.origin;
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${redirectTo}/reset-password?src=${src}`,
  });
  if (error) throw error;
}
