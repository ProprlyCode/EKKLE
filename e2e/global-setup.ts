import { admin, DAVID, SARAH } from './support/supabase';

/**
 * Give the seeded member David and leader Sarah a real sign-in (email + password) so the tests
 * can act as him. Idempotent: reuses the auth user if a previous run made it.
 */
export default async function globalSetup() {
  const sb = admin();
  const { data: list, error: listError } = await sb.auth.admin.listUsers();
  if (listError) throw listError;

  for (const person of [DAVID, SARAH]) {
    let authUser = list.users.find((u) => u.email === person.email);
    if (!authUser) {
      const { data, error } = await sb.auth.admin.createUser({
        email: person.email,
        password: person.password,
        email_confirm: true,
      });
      if (error) throw error;
      authUser = data.user;
    }
    const { error } = await sb
      .from('users')
      .update({ auth_uid: authUser.id, email: person.email, active: true })
      .eq('id', person.userId);
    if (error) throw error;
  }
}
