import { MEMBER, SCREENS } from './chapters';

/**
 * B's phone, full size — the camera dives into it in chapter 4. Inside are the
 * real Ekklē recipient screens in the product's own look (cream surface, sage
 * serif headlines). Scroll plays them: the journey timeline cross-fades the
 * `phone-screen-*` layers, fills the `phone-bar-*` progress, and swaps the
 * button from Continue → "Message Sam" → sent (chapter 5).
 */
export function Phone({ reduced = false }: { reduced?: boolean }) {
  return (
    <div
      data-j="phone"
      className="relative aspect-[9/19] w-[min(320px,72vw)] max-h-[82svh] rounded-[44px] bg-[#0d0f10] p-[10px] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.9)]"
      role="img"
      aria-label={`B's phone, showing the Ekklē message ${MEMBER} shared`}
    >
      <div className="relative flex h-full flex-col overflow-hidden rounded-[34px] bg-home-cream">
        <div className="mx-auto mt-2.5 h-[22px] w-[84px] rounded-full bg-[#0d0f10]" aria-hidden />

        <div className="flex gap-1.5 px-6 pt-5" aria-hidden>
          {SCREENS.map((_, i) => (
            <span key={i} className="relative h-1 flex-1 overflow-hidden rounded-full bg-home-stone-dim/60">
              <span
                data-j={`phone-bar-${i}`}
                className="absolute inset-0 origin-left rounded-full bg-home-sage/70"
                style={reduced ? undefined : { transform: i === 0 ? 'scaleX(1)' : 'scaleX(0)' }}
              />
            </span>
          ))}
        </div>

        <p className="px-6 pt-5 text-[12px] text-[#8a8676]">A note from {MEMBER}</p>

        <div className="relative flex-1 px-6 pt-4">
          {SCREENS.map((s, i) => (
            <div
              key={s.headline}
              data-j={`phone-screen-${i}`}
              className="absolute inset-x-6 top-4"
              style={reduced ? undefined : { opacity: i === 0 ? 1 : 0 }}
              hidden={reduced && i !== SCREENS.length - 1}
            >
              <h3 className="font-serif text-[clamp(22px,2vw,26px)] font-medium leading-tight text-home-sage">
                {s.headline}
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed text-[#6b6754]">{s.body}</p>
            </div>
          ))}
        </div>

        <div className="relative h-[76px] px-6 pb-6">
          <span
            data-j="phone-btn-continue"
            className="absolute inset-x-6 bottom-6 flex h-11 items-center justify-center rounded-xl bg-home-brass text-[14px] font-medium text-home-ink"
            style={reduced ? { opacity: 0 } : undefined}
          >
            Continue
          </span>
          <span
            data-j="phone-btn-message"
            className="absolute inset-x-6 bottom-6 flex h-11 items-center justify-center rounded-xl bg-home-brass text-[14px] font-medium text-home-ink"
            style={{ opacity: reduced ? 1 : 0 }}
          >
            Message {MEMBER}
          </span>
          <span
            data-j="phone-btn-sent"
            className="absolute inset-x-6 bottom-6 flex h-11 items-center justify-center rounded-xl border border-home-sage/30 text-[14px] text-home-sage"
            style={{ opacity: 0 }}
          >
            Message sent to {MEMBER}
          </span>
        </div>
      </div>
    </div>
  );
}
