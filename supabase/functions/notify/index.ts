// Ekklē notify — email on new messages.
//
// Called by the messages_notify trigger (migration 0019) on INSERT into
// public.messages. Emails the right person via Resend:
//   * recipient's message → the member (+ a metadata-only awareness note to the
//     church's leaders on the FIRST message of a conversation)
//   * member's reply       → the recipient, with a link back into the thread
//
// Secrets (set by CI): RESEND_API_KEY, NOTIFY_FROM, SITE_URL, NOTIFY_SECRET.
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by the platform.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { fromOurTrigger, sendEmail, SITE_URL } from '../_shared/email.ts';

interface MessageRecord {
  id: string;
  conversation_id: string;
  sender_type: 'member' | 'recipient';
  body: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
);

Deno.serve(async (req) => {
  if (!fromOurTrigger(req)) return new Response('unauthorized', { status: 401 });
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
        'id, org_id, member:users(name, email, code_slug), recipient:recipients(first_name, email, auth_uid)',
      )
      .eq('id', record.conversation_id)
      .single();
    if (!convo) return new Response('no conversation', { status: 200 });

    const member = convo.member as unknown as {
      name: string;
      email: string | null;
      code_slug: string;
    };
    const recipient = convo.recipient as unknown as {
      first_name: string;
      email: string | null;
      auth_uid: string | null;
    };
    const appLink = SITE_URL ? `${SITE_URL}/app/messages` : '';

    if (record.sender_type === 'recipient') {
      // Notify the member.
      await sendEmail(
        member.email,
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
      // Seekers with an account read it in their studies area; everyone else
      // through the member's link (which resumes the conversation).
      const back = !SITE_URL
        ? ''
        : recipient.auth_uid
          ? `${SITE_URL}/studies/connection`
          : `${SITE_URL}/r/${member.code_slug}`;
      await sendEmail(
        recipient.email,
        `${member.name} replied`,
        `${member.name} sent you a message:\n\n“${record.body}”\n\n` +
          (back ? `Read and reply: ${back}\n` : 'Open the link they shared with you to reply.\n'),
      );
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('notify error', e);
    return new Response('error', { status: 200 }); // never block the insert
  }
});
