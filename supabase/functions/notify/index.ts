// Ekklē notify — email on new messages.
//
// Wired as a Supabase Database Webhook on INSERT into public.messages. For each
// new message it emails the right person via Resend:
//   * recipient's message  → email the member (+ a metadata-only awareness note
//     to the org's leaders on the FIRST message of a conversation)
//   * member's reply        → email the recipient
//
// Secrets (Edge Function config): RESEND_API_KEY, NOTIFY_FROM (e.g.
// "Ekklē <hello@ekkle.org>"), SITE_URL. SUPABASE_URL and
// SUPABASE_SERVICE_ROLE_KEY are provided by the platform.
//
// If RESEND_API_KEY is absent the function no-ops cleanly, so the app works
// before email is configured.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_type: 'member' | 'recipient';
  body: string;
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
    const record: MessageRecord | undefined = payload.record;
    if (!record?.conversation_id) {
      return new Response('ignored', { status: 200 });
    }

    // Conversation → member + recipient + org.
    const { data: convo } = await supabase
      .from('conversations')
      .select(
        'id, org_id, member:users(name, email), recipient:recipients(first_name, email)',
      )
      .eq('id', record.conversation_id)
      .single();
    if (!convo) return new Response('no conversation', { status: 200 });

    const member = convo.member as unknown as { name: string; email: string | null };
    const recipient = convo.recipient as unknown as {
      first_name: string;
      email: string | null;
    };
    const appLink = SITE_URL ? `${SITE_URL}/app/messages` : '';

    if (record.sender_type === 'recipient') {
      // Notify the member.
      await sendEmail(
        member.email ?? '',
        `${recipient.first_name || 'Someone'} messaged you on Ekklē`,
        `${recipient.first_name || 'Someone'} you shared with just reached out:\n\n` +
          `“${record.body}”\n\n` +
          (appLink ? `Reply here: ${appLink}\n` : ''),
      );

      // First message of the conversation → lightweight awareness to leaders.
      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('conversation_id', record.conversation_id);
      if ((count ?? 0) <= 1) {
        const { data: leaders } = await supabase
          .from('users')
          .select('email')
          .eq('org_id', convo.org_id)
          .in('role', ['leadership', 'platform_admin']);
        for (const l of leaders ?? []) {
          const email = (l as { email: string | null }).email;
          if (!email || email === member.email) continue;
          await sendEmail(
            email,
            'A new connection on Ekklē',
            `${recipient.first_name || 'Someone'} connected with ${member.name}. ` +
              `This is just for your awareness — no action needed.`,
          );
        }
      }
    } else {
      // Member replied → notify the recipient.
      await sendEmail(
        recipient.email ?? '',
        `${member.name} replied`,
        `${member.name} sent you a message:\n\n“${record.body}”\n\n` +
          `Open the link they shared with you to reply.`,
      );
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('notify error', e);
    return new Response('error', { status: 200 }); // never block the insert
  }
});
