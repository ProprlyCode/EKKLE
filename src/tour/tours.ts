import type { TourStep } from './Tour';

/** The guided tours' words. Each step lights one thing on the screen. */

const nav = (to: string) => `[data-tour="nav:${to}"]`;

export const SEEKER_TOUR: TourStep[] = [
  {
    title: 'Welcome to Your space',
    body: 'Everything that’s yours lives here — your conversation, your studies and your Bible — on any device you sign in on.',
  },
  {
    target: nav('/space/messages'),
    title: 'Messages',
    body: 'Your conversation with the person who shared this with you. Write whenever you like; they’ll reply personally.',
  },
  {
    target: nav('/space/studies'),
    title: 'Studies',
    body: 'Short, free Bible studies at your own pace. Each one opens the next, and you can ask for a weekly reminder.',
  },
  {
    target: nav('/space/bible'),
    title: 'Bible',
    body: 'Today’s devotional from the ministry, three translations, search, highlights and notes. Reading plans are here too, if you’d like a path through.',
  },
  {
    target: nav('/space/resources'),
    title: 'Resources',
    body: 'Articles and videos your ministry has chosen for people exploring faith.',
  },
  {
    target: nav('/space/account'),
    title: 'Account',
    body: 'How you sign in — and where you can delete your details at any time.',
  },
  {
    target: '[data-tour="install"]',
    title: 'Keep it on your phone',
    body: 'Add Your space to your home screen and it opens like an app.',
  },
];

export const MEMBER_TOUR: TourStep[] = [
  {
    target: '#your-code',
    title: 'Your code',
    body: 'Hold it up for someone to scan, copy your link, or download it. Anyone who opens it meets a short introduction — and you. Sharing somewhere specific? Tap a situation under your code for that moment.',
  },
  {
    target: '[aria-label="Faith in action"]',
    title: 'Faith in action',
    body: 'A small idea each week for everyday moments to share your faith, with more to browse.',
  },
  {
    target: '#your-photo',
    title: 'Your photo and message',
    body: 'People see your photo, name and short message before they write to you. A friendly face helps.',
  },
  {
    target: nav('/app/messages'),
    title: 'Messages',
    body: 'When someone writes, it comes here (and by email). Reply personally — and when you’ve met, tell us with one tap.',
  },
  {
    target: nav('/app/bible'),
    title: 'Bible',
    body: 'The same Bible your friends read, with today’s devotional from your ministry, notes, highlights and reading plans.',
  },
  {
    target: '[aria-label="Get started"]',
    title: 'Get started',
    body: 'A few steps to be ready. They tick themselves off as you go.',
  },
];

const LEADERSHIP: TourStep[] = [
  {
    target: nav('/leadership/overview'),
    title: 'Overview',
    body: 'What’s come of sharing: links opened, conversations, people who connected and studies — for the ministry and each member. Counts only, never messages.',
  },
  {
    target: '[data-tour="conversations"]',
    title: 'Conversations',
    body: 'Who’s waiting for a reply, and moving a conversation to someone else when needed.',
  },
  {
    target: nav('/leadership/content'),
    title: 'Content',
    body: 'The short introductions people walk through when they open a member’s link. Start from one of Ekklē’s templates, offer some as situations members can tap under their code, and preview each exactly as people will see it.',
  },
  {
    target: nav('/leadership/resources'),
    title: 'Resources',
    body: 'Bible studies, reading plans, daily devotionals, Faith in action prompts, and articles or videos. Try writing a devotional: it shows at the top of everyone’s Bible tab.',
  },
  {
    target: nav('/leadership/people'),
    title: 'People',
    body: 'Invite your team, pause or remove someone, and see any reports.',
  },
];

export const LEADER_TOUR: TourStep[] = LEADERSHIP;

export const ADMIN_TOUR: TourStep[] = [
  ...LEADERSHIP,
  {
    target: nav('/leadership/account'),
    title: 'Account',
    body: 'Your name, logo and colour, your address, and settings like the join code.',
  },
];
