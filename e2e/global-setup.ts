import { admin, DAVID, OWEN, SARAH } from './support/supabase';

/**
 * Give the seeded member David and ministry Admin Sarah a real sign-in (email +
 * password) so the tests can act as them, and put Owen on the Ekklē team.
 * Idempotent: reuses the auth user if a previous run made it.
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

  // Owen: the Ekklē team (platform Owner), with no ministry membership.
  let owen = list.users.find((u) => u.email === OWEN.email);
  if (!owen) {
    const { data, error } = await sb.auth.admin.createUser({
      email: OWEN.email,
      password: OWEN.password,
      email_confirm: true,
    });
    if (error) throw error;
    owen = data.user;
  }
  // Owen has already chosen his password (first sign-ins are tested in roles.spec).
  const { data: seat } = await sb.from('platform_team').select('id').eq('email', OWEN.email).maybeSingle();
  const { error: seatError } = seat
    ? await sb.from('platform_team').update({ password_set: true }).eq('id', seat.id)
    : await sb.from('platform_team').insert({ email: OWEN.email, role: 'owner', name: 'Owen', password_set: true });
  if (seatError) throw seatError;
}
