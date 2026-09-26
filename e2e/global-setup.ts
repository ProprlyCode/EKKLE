import { admin, DAVID } from './support/supabase';

/**
 * Give the seeded member David a real sign-in (email + password) so the tests
 * can act as him. Idempotent: reuses the auth user if a previous run made it.
 */
export default async function globalSetup() {
  const sb = admin();

  const { data: list, error: listError } = await sb.auth.admin.listUsers();
  if (listError) throw listError;
  let authUser = list.users.find((u) => u.email === DAVID.email);
  if (!authUser) {
    const { data, error } = await sb.auth.admin.createUser({
      email: DAVID.email,
      password: DAVID.password,
      email_confirm: true,
    });
    if (error) throw error;
    authUser = data.user;
  }

  const { error } = await sb
    .from('users')
    .update({ auth_uid: authUser.id, email: DAVID.email, active: true })
    .eq('id', DAVID.userId);
  if (error) throw error;
}
