/**
 * A thin ribbon on every page of staging.ekkle.org (and Vercel previews), so no
 * one mistakes demo data for the real thing. Renders nothing in production.
 */
export function StagingBanner() {
  if (import.meta.env.VITE_APP_ENV !== 'staging') return null;
  return (
    <div
      role="note"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[100] bg-[#a9824c] py-1 text-center text-[11px] font-medium uppercase tracking-[0.18em] text-[#232a2e]"
    >
      Staging · demo data only
    </div>
  );
}
