// Ekklē notify-report — email church leaders when a conversation is reported.
//
// Called by the reports_notify trigger (migration 0019) on INSERT into public.reports. Emails the
// org's leaders a metadata-only alert (who reported, which member/recipient, the
// note) — never message contents. No-ops cleanly when RESEND_API_KEY is absent.
//
// Secrets (set by CI): RESEND_API_KEY, NOTIFY_FROM, SITE_URL, NOTIFY_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fromOurTrigger, sendEmail, SITE_URL } from '../_shared/email.ts';

interface ReportRecord {
  id: string;
  conversation_id: string;
  reporter_type: 'member' | 'recipient';
  reason: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (!fromOurTrigger(req)) return new Response('unauthorized', { status: 401 });
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
