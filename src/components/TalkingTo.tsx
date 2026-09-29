import { photoUrl } from '@/data/members';
import type { MemberCard } from '@/data/recipient';

/** A member's photo, or their initials when they haven't added one. */
export function PersonPhoto({ name, photo, size = 56 }: { name: string; photo: string | null; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter((w) => /^\p{L}/u.test(w))
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
  return photo ? (
    <img
      src={photoUrl(photo)}
      alt={name}
      width={size}
      height={size}
      className="shrink-0 rounded-full border border-edge object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-sage/10 font-serif text-sage"
      style={{ width: size, height: size, fontSize: Math.max(11, size * 0.36) }}
    >
      {initials || '·'}
    </span>
  );
}

/**
 * "Who you're talking to" (N3): shown before a seeker writes — who will read
 * it, where they're from, and that the seeker can delete their details.
 */
export function TalkingTo({ member, className = '' }: { member: MemberCard; className?: string }) {
  return (
    <section
      aria-label="Who you’re talking to"
      className={`flex flex-col gap-3 rounded-lg border border-edge bg-card px-4 py-4 ${className}`}
    >
      <div className="flex items-center gap-3">
        <PersonPhoto name={member.name} photo={member.photo} />
        <div className="min-w-0">
          <p className="font-serif text-lg leading-tight text-sage">{member.name}</p>
          {member.ministry && <p className="text-[13px] text-muted">{member.ministry}</p>}
        </div>
      </div>
      {member.short_message && (
        <p className="text-[14px] leading-relaxed text-muted-strong">“{member.short_message}”</p>
      )}
      <ul className="flex flex-col gap-1 text-[12px] leading-relaxed text-muted">
        <li>Your messages go to {member.name}, who’ll reply personally.</li>
        <li>You can delete your details at any time in Your space → Account.</li>
      </ul>
    </section>
  );
}
