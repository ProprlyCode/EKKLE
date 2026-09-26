// Staging demo personas — one login per kind of person, for auditing the app
// as them on staging.ekkle.org. Run by CI after staging migrations + seed.
// Idempotent: creates or updates each auth user, then links it to its app row.
//
// Env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (staging), DEMO_PASSWORD.
import { createClient } from '@supabase/supabase-js';

const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, DEMO_PASSWORD } = process.env;
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !DEMO_PASSWORD) {
  throw new Error('SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY and DEMO_PASSWORD are required');
}
const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const ORG = '00000000-0000-0000-0000-0000000000a1'; // seed.sql pilot church
const PERSONAS = [
  // Seeded app rows (supabase/seed.sql) get a login attached.
  { email: 'leader@demo.ekkle.org', userId: '00000000-0000-0000-0000-0000000000b1' }, // Sarah, leadership
  { email: 'member@demo.ekkle.org', userId: '00000000-0000-0000-0000-0000000000b2' }, // David, member
  // Platform admin: created here (production's founder row isn't seeded).
  {
    email: 'admin@demo.ekkle.org',
    create: { org_id: ORG, name: 'Demo admin', role: 'platform_admin', code_slug: 'demo-admin' },
  },
  // Seeker: just an auth account; the app creates their study profile on first sign-in.
  { email: 'seeker@demo.ekkle.org' },
];

const { data: list, error: listError } = await sb.auth.admin.listUsers({ perPage: 1000 });
if (listError) throw listError;

for (const p of PERSONAS) {
  let user = list.users.find((u) => u.email === p.email);
  if (user) {
    const { error } = await sb.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD });
    if (error) throw error;
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email: p.email,
      password: DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error) throw error;
    user = data.user;
  }

  if (p.userId) {
    const { error } = await sb.from('users').update({ auth_uid: user.id, email: p.email, active: true }).eq('id', p.userId);
    if (error) throw error;
  } else if (p.create) {
    const { error } = await sb
      .from('users')
      .upsert({ ...p.create, auth_uid: user.id, email: p.email, active: true }, { onConflict: 'code_slug' });
    if (error) throw error;
  }
  console.log(`persona ready: ${p.email}`);
}
