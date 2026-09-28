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
import { accountInfo, fromAccount, fromOurTrigger, sendEmail, SITE_URL } from '../_shared/email.ts';
import { readingLabel } from '../_shared/books.ts';

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
    if (payload.record?.kind === 'reading') {
      await dailyReading(payload.record.auth_uid, payload.record.plan_id);
      return new Response('ok', { status: 200 });
    }
    if (payload.record?.kind === 'address_request' || payload.record?.kind === 'address_decided') {
      await addressRequest(payload.record.kind, payload.record.request_id);
      return new Response('ok', { status: 200 });
    }
    if (payload.record?.kind === 'study') {
      await studyReminder(payload.record.auth_uid, payload.record.org_id, payload.record.study);
      return new Response('ok', { status: 200 });
    }
    if (payload.record?.kind === 'nudge' || payload.record?.kind === 'escalate') {
      await followUp(payload.record.kind, payload.record.conversation_id);
      return new Response('ok', { status: 200 });
    }
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
    const { base, name: accountName } = await accountInfo(supabase, convo.org_id);
    const from = fromAccount(accountName);
    const appLink = base ? `${base}/app/messages` : '';

    if (record.sender_type === 'recipient') {
      // Notify the member.
      await sendEmail(
        member.email,
        `${recipient.first_name || 'Someone'} messaged you on Ekklē`,
        `${recipient.first_name || 'Someone'} you shared with just reached out:\n\n` +
          `“${record.body}”\n\n` +
          (appLink ? `Reply here: ${appLink}\n` : ''),
        from,
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
          .in('role', ['admin', 'leader']);
        for (const l of leaders ?? []) {
          const email = (l as { email: string | null }).email;
          if (!email || email === member.email) continue;
          await sendEmail(
            email,
            'A new connection on Ekklē',
            `${recipient.first_name || 'Someone'} connected with ${member.name}. ` +
              `This is just for your awareness — no action needed.`,
            from,
          );
        }
      }
    } else {
      // Member replied → notify the recipient.
      // Seekers with an account read it in Your space; everyone else
      // through the member's link (which resumes the conversation).
      const back = !base
        ? ''
        : recipient.auth_uid
          ? `${base}/space/messages`
          : `${base}/r/${member.code_slug}`;
      await sendEmail(
        recipient.email,
        `${member.name} replied`,
        `${member.name} sent you a message:\n\n“${record.body}”\n\n` +
          (back ? `Read and reply: ${back}\n` : 'Open the link they shared with you to reply.\n'),
        from,
      );
    }

    return new Response('ok', { status: 200 });
  } catch (e) {
    console.error('notify error', e);
    return new Response('error', { status: 200 }); // never block the insert
  }
});

// Follow-through (migration 0035): someone has been waiting for a reply.
//   nudge    (24h) → the member, with a link to the conversation
//   escalate (48h) → the ministry's Admins and Leaders, metadata only
async function followUp(kind: 'nudge' | 'escalate', conversationId: string) {
  const { data: convo } = await supabase
    .from('conversations')
    .select('id, org_id, member:users(name, email, active), recipient:recipients(first_name)')
    .eq('id', conversationId)
    .single();
  if (!convo) return;
  const member = convo.member as unknown as { name: string; email: string | null; active: boolean };
  const firstName =
    (convo.recipient as unknown as { first_name: string | null }).first_name || 'Someone';
  const { base, name: accountName } = await accountInfo(supabase, convo.org_id);
  const from = fromAccount(accountName);

  if (kind === 'nudge') {
    if (!member.active) return;
    await sendEmail(
      member.email,
      `${firstName} is waiting to hear from you`,
      `${firstName} wrote to you a day ago and hasn't heard back yet.\n\n` +
        (base ? `Reply here: ${base}/app/messages/${convo.id}\n` : ''),
      from,
    );
    return;
  }

  const { data: leaders } = await supabase
    .from('users')
    .select('email')
    .eq('org_id', convo.org_id)
    .eq('active', true)
    .is('removed_at', null)
    .in('role', ['admin', 'leader']);
  for (const l of leaders ?? []) {
    const email = (l as { email: string | null }).email;
    if (!email || email === member.email) continue;
    await sendEmail(
      email,
      `${firstName} has been waiting two days`,
      `${firstName} wrote to ${member.name} two days ago and hasn't had a reply yet. ` +
        `You may want to check in with ${member.name}, or move the conversation to someone else.\n\n` +
        (base ? `Conversations: ${base}/leadership/overview\n` : '') +
        `\nThis note never includes what anyone wrote.`,
      from,
    );
  }
}

// Reading plans (migration 0038): today's reading, for someone who turned the
// daily email on — the next day they haven't ticked off.
async function dailyReading(authUid: string, planId: string) {
  const { data: progress } = await supabase
    .from('reading_progress')
    .select('done_days, org_id, area, plan:reading_plans(title)')
    .eq('auth_uid', authUid)
    .eq('plan_id', planId)
    .single();
  if (!progress) return;
  const done: number[] = progress.done_days ?? [];
  const { data: days } = await supabase
    .from('reading_plan_days')
    .select('day, readings')
    .eq('plan_id', planId)
    .order('day');
  const next = (days ?? []).find((d: { day: number }) => !done.includes(d.day)) as
    | { day: number; readings: string[] }
    | undefined;
  if (!next) return;
  const { data: user } = await supabase.auth.admin.getUserById(authUid);
  const email = user?.user?.email;
  if (!email) return;

  const title = (progress.plan as unknown as { title: string } | null)?.title ?? 'Your reading plan';
  const { base, name } = progress.org_id
    ? await accountInfo(supabase, progress.org_id)
    : { base: Deno.env.get('SITE_URL') ?? '', name: null };
  const link = base ? `${base}/${progress.area === 'app' ? 'app' : 'space'}/bible/plans/${planId}` : '';
  const passages = next.readings.map(readingLabel).join('; ');
  await sendEmail(
    email,
    `Today’s reading: ${passages}`,
    `${title} — day ${next.day}\n\n${passages}\n\n` +
      (link ? `Read it here: ${link}\n\n` : '') +
      `You asked for this daily email. To stop it, open the plan and choose “Turn off”.`,
    fromAccount(name),
  );
}

/** The weekly study reminder a seeker asked for (0041): the study to do next. */
async function studyReminder(
  authUid: string,
  orgId: string,
  study: { id: string; number: number; title: string; started: boolean; page: number },
) {
  const { data: user } = await supabase.auth.admin.getUserById(authUid);
  const email = user?.user?.email;
  if (!email || !study?.id) return;
  const { base, name } = await accountInfo(supabase, orgId);
  const link = base ? `${base}/space/studies/${study.id}` : '';
  await sendEmail(
    email,
    study.started ? `Pick up where you left off: ${study.title}` : `Your next study is ready: ${study.title}`,
    `${study.number}. ${study.title}` +
      (study.started ? ` — you’re on page ${study.page}.` : '') +
      `\n\n` +
      (link ? `Open it here: ${link}\n\n` : '') +
      `You asked for this weekly reminder. To stop it, open Studies and choose “Turn off”.`,
    fromAccount(name),
  );
}

/**
 * Address change requests (0043): the Ekklē team's Owners and Admins hear of
 * a new one; the Admin who asked hears the decision.
 */
async function addressRequest(kind: 'address_request' | 'address_decided', requestId: string) {
  const { data: req } = await supabase
    .from('address_requests')
    .select('org_id, subdomain, from_subdomain, note, status, reason, requester:users(name, email)')
    .eq('id', requestId)
    .single();
  if (!req) return;
  const requester = req.requester as unknown as { name: string; email: string | null } | null;
  const { base, name } = await accountInfo(supabase, req.org_id);
  const ministry = name ?? 'A ministry';

  if (kind === 'address_request') {
    const { data: team } = await supabase.from('platform_team').select('email').in('role', ['owner', 'admin']);
    const link = SITE_URL ? `${SITE_URL}/platform` : '';
    for (const t of team ?? []) {
      await sendEmail(
        (t as { email: string | null }).email,
        `${ministry} asked for a new address: ${req.subdomain}`,
        `${requester?.name ?? 'An Admin'} at ${ministry} asked to move from ${req.from_subdomain} to ${req.subdomain}.` +
          (req.note ? `\n\nTheir note: “${req.note}”` : '') +
          (link ? `\n\nApprove or decline it in the console: ${link}` : ''),
      );
    }
    return;
  }

  if (!requester?.email) return;
  await sendEmail(
    requester.email,
    req.status === 'approved' ? `Your new address is ready: ${req.subdomain}` : 'About your address request',
    req.status === 'approved'
      ? `${ministry} has moved to its new address${base ? `: ${base}` : ` (${req.subdomain})`}.\n\n` +
          `Your old address still works and leads there, so printed codes and shared links keep working. ` +
          `Everyone will be asked to sign in once at the new address.`
      : `Your request to move ${ministry} to ${req.subdomain} wasn’t approved.` +
          (req.reason ? `\n\n“${req.reason}”` : '') +
          `\n\nYou can ask for a different address in Account.`,
    fromAccount(name),
  );
}
