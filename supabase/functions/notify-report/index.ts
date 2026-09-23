// Ekklē notify-report — email church leaders when a conversation is reported.
//
// Wired as a Supabase Database Webhook on INSERT into public.reports. Emails the
// org's leaders a metadata-only alert (who reported, which member/recipient, the
// note) — never message contents. No-ops cleanly when RESEND_API_KEY is absent.
//
// Secrets (Edge Function config): RESEND_API_KEY, NOTIFY_FROM, SITE_URL.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface ReportRecord {
  id: string;
  conversation_id: string;
  reporter_type: 'member' | 'recipient';
  reason: string;
}

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const NOTIFY_FROM = Deno.env.get('NOTIFY_FROM') ?? 'Ekklē <hello@ekkle.org>';
const SITE_URL = Deno.env.get('SITE_URL') ?? '';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

async function sendEmail(to: string, subject: string, text: string) {
  if (!RESEND_API_KEY || !to) return;
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: NOTIFY_FROM, to, subject, text }),
  }).catch((e) => console.error('resend error', e));
}

Deno.serve(async (req) => {
  try {
    const payload = await req.json();
    const record: ReportRecord | undefined = payload.record;
    if (!record?.conversation_id) return new Response('ignored', { status: 200 });

    const { data: convo } = await supabase
      .from('conversations')
      .select('org_id, member:users(name), recipient:recipients(first_name)')
      .eq('id', record.conversation_id)
      .single();
    if (!convo) return new Response('no conversation', { status: 200 });

    const member = convo.member as unknown as { name: string };
    const recipient = convo.recipient as unknown as { first_name: string };
    const who = record.reporter_type === 'member' ? member.name : 'a recipient';
    const link = SITE_URL ? `${SITE_URL}/leadership/people` : '';

    const { data: leaders } = await supabase
      .from('users')
      .select('email')
      .eq('org_id', convo.org_id)
      .in('role', ['leadership', 'platform_admin']);

    for (const l of leaders ?? []) {
      const email = (l as { email: string | null }).email;
      if (!email) continue;
      await sendEmail(
        email,
        'A conversation was reported on Ekklē',
        `A conversation was blocked and reported by ${who}.\n\n` +
          `Between: ${member.name} and ${recipient.first_name || 'a recipient'}\n` +
          (record.reason ? `Note: “${record.reason}”\n` : '') +
          `\nReview it${link ? `: ${link}` : ' in the People area.'}\n\n` +
          `You’ll only ever see this summary — never the messages themselves.`,
      );
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('notify-report error', e);
    return new Response('error', { status: 200 });
  }
});
