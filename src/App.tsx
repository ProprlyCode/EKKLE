import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import {
  RequireAuth,
  RequireMembership,
  RequireLeadership,
  RequireAccountAdmin,
  AuthedLayout,
} from '@/auth/guards';
import { Wordmark } from '@/components/Wordmark';
import { FullPageLoading } from '@/ui/states';
import { useAccount } from '@/account/AccountProvider';
import FindAccount from '@/account/FindAccount';
import AccountHome from '@/account/AccountHome';
import { LegacyMemberLink, ToPlatform } from '@/account/Redirects';
import { platformUrl } from '@/account/address';
import SignIn from '@/routes/SignIn';
import ResetPassword from '@/routes/ResetPassword';
import Onboarding from '@/routes/Onboarding';
import { PlatformGate } from '@/platform/PlatformGate';
import RecipientExperience from '@/recipient/RecipientExperience';
import SeekerGate from '@/space/SeekerGate';
import SeekerLayout from '@/space/SeekerLayout';
import Connection from '@/space/Connection';
import Account, { DetailsDeleted } from '@/space/Account';
import SpaceHome from '@/space/SpaceHome';
import Offer from '@/public/Offer';

// Loaded when first opened, so someone opening a member's link or signing in
// to Your space downloads only what they need (pilot readiness, slow phones).
// The cinematic homepage too, so GSAP/Lenis never load in the product.
const Home = lazy(() => import('@/public/home/Home'));
const ForMinistries = lazy(() => import('@/public/ForMinistries'));
const MemberDashboard = lazy(() => import('@/routes/member/Dashboard'));
const Inbox = lazy(() => import('@/routes/member/Inbox'));
const Thread = lazy(() => import('@/routes/member/Thread'));
const StudyDashboard = lazy(() => import('@/space/StudyDashboard'));
const StudyReader = lazy(() => import('@/space/StudyReader'));
const ResourcesLibrary = lazy(() => import('@/space/ResourcesLibrary'));
const ResourcePage = lazy(() => import('@/space/ResourcePage'));
const BibleReader = lazy(() => import('@/bible/BibleReader'));
const PlanList = lazy(() => import('@/bible/ReadingPlans').then((m) => ({ default: m.PlanList })));
const PlanPage = lazy(() => import('@/bible/ReadingPlans').then((m) => ({ default: m.PlanPage })));
const WalletCards = lazy(() => import('@/routes/member/WalletCards'));
const Overview = lazy(() => import('@/routes/leadership/Overview'));
const Content = lazy(() => import('@/routes/leadership/Content'));
const People = lazy(() => import('@/routes/leadership/People'));
const Resources = lazy(() => import('@/routes/leadership/Resources'));
const AccountSettings = lazy(() => import('@/routes/leadership/AccountSettings'));
const StudyLibrary = lazy(() => import('@/studies/StudyLibrary').then((m) => ({ default: m.StudyLibrary })));
const StudyEditor = lazy(() => import('@/studies/StudyEditor').then((m) => ({ default: m.StudyEditor })));
const PlanLibrary = lazy(() => import('@/bible/PlanLibrary').then((m) => ({ default: m.PlanLibrary })));
const PlanEditor = lazy(() => import('@/bible/PlanLibrary').then((m) => ({ default: m.PlanEditor })));
const PromptLibrary = lazy(() => import('@/prompts/PromptLibrary').then((m) => ({ default: m.PromptLibrary })));
const PlatformLayout = lazy(() => import('@/platform/PlatformLayout'));
const PlatformAccounts = lazy(() => import('@/platform/Accounts'));
const PlatformSettings = lazy(() => import('@/platform/Settings'));
const PlatformTeam = lazy(() => import('@/platform/Team'));
const PlatformWaitlist = lazy(() => import('@/platform/Waitlist'));
const PlatformOutcomes = lazy(() => import('@/platform/Outcomes'));

/**
 * Route map (docs/tenancy.md). The address decides which set applies:
 *  - ekkle.org (platform): Ekklē itself — the homepage story, For ministries,
 *    the platform console. Old account links are sent on to their account.
 *  - an account's address (<sub>.ekkle.org or its own domain): member links,
 *    the offer page, Your space, and the members' & leaders' app.
 */
export default function App() {
  const account = useAccount();
  if (account.status === 'loading') return <FullPageLoading />;
  if (account.status === 'unknown') return <UnknownAddress />;
  if (account.status === 'account' && account.account.status === 'suspended')
    return <PausedAddress name={account.account.name} />;
  return (
    <Suspense fallback={<FullPageLoading />}>
      {account.status === 'platform' ? <PlatformRoutes /> : <AccountRoutes />}
    </Suspense>
  );
}

function PlatformRoutes() {
  return (
    <Routes>
      <Route
        path="/"
        element={
          <Suspense fallback={<div className="min-h-screen bg-[#232a2e]" />}>
            <Home />
          </Suspense>
        }
      />
      <Route path="/for-ministries" element={<ForMinistries />} />
      <Route path="/for-churches" element={<Navigate to="/for-ministries" replace />} />
      {/* Not linked from the marketing pages: platform admins use /sign-in;
          members and seekers sign in on their account's own address. */}
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/find" element={<FindAccount />} />

      {/* The Ekklē team's console (platform_team only), never a ministry's. */}
      <Route element={<PlatformGate />}>
        <Route element={<PlatformLayout />}>
          <Route path="/platform" element={<PlatformAccounts />} />
          <Route path="/platform/outcomes" element={<PlatformOutcomes />} />
          <Route path="/platform/team" element={<PlatformTeam />} />
          <Route path="/platform/waitlist" element={<PlatformWaitlist />} />
          <Route path="/platform/settings" element={<PlatformSettings />} />
          <Route path="/platform/studies" element={<StudyLibrary base="/platform/studies" bank />} />
          <Route path="/platform/studies/:studyId" element={<StudyEditor base="/platform/studies" />} />
          <Route path="/platform/plans" element={<PlanLibrary base="/platform/plans" bank />} />
          <Route path="/platform/plans/:planId" element={<PlanEditor base="/platform/plans" />} />
          <Route path="/platform/prompts" element={<PromptLibrary bank />} />
        </Route>
      </Route>

      {/* Account pages opened on ekkle.org → that account's address. */}
      <Route path="/r/:slug" element={<LegacyMemberLink />} />
      <Route path="/offer" element={<LegacyMemberLink />} />
      {['/space/*', '/studies/*', '/app/*', '/leadership/*', '/welcome'].map((path) => (
        <Route key={path} path={path} element={<FindAccount />} />
      ))}

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

function AccountRoutes() {
  return (
    <Routes>
      <Route path="/" element={<AccountHome />} />
      <Route path="/for-ministries" element={<ToPlatform />} />
      <Route path="/for-churches" element={<ToPlatform />} />
      <Route path="/platform" element={<ToPlatform />} />
      <Route path="/offer" element={<Offer />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Recipient experience (no login) */}
      <Route path="/r/:slug" element={<RecipientExperience />} />

      {/* Your space — a seeker's own gated home. Signed out → the seeker sign-in
          (then back to the page they asked for); signed in → home, messages,
          studies (with the immersive reader), resources, and account. */}
      <Route element={<SeekerGate />}>
        <Route path="/space/studies/:studyId" element={<StudyReader />} />
        <Route element={<SeekerLayout />}>
          <Route path="/space" element={<SpaceHome />} />
          <Route path="/space/messages" element={<Connection />} />
          <Route path="/space/studies" element={<StudyDashboard />} />
          <Route path="/space/bible" element={<BibleReader base="/space/bible" stickyTop="top-[53px]" />} />
          <Route path="/space/bible/:book/:chapter" element={<BibleReader base="/space/bible" stickyTop="top-[53px]" />} />
          <Route path="/space/bible/plans" element={<PlanList base="/space/bible" />} />
          <Route path="/space/bible/plans/:planId" element={<PlanPage base="/space/bible" />} />
          <Route path="/space/resources" element={<ResourcesLibrary />} />
          <Route path="/space/resources/:resourceId" element={<ResourcePage />} />
          <Route path="/space/account" element={<Account />} />
        </Route>
      </Route>
      <Route path="/space/deleted" element={<DetailsDeleted />} />
      {/* Old study-area links (emails already sent, bookmarks). */}
      <Route path="/studies" element={<Navigate to="/space/studies" replace />} />
      <Route path="/studies/connection" element={<Navigate to="/space/messages" replace />} />
      <Route path="/studies/account" element={<Navigate to="/space/account" replace />} />
      <Route path="/studies/:studyId" element={<StudyRedirect />} />

      <Route element={<RequireAuth />}>
        <Route path="/welcome" element={<Onboarding />} />

        <Route element={<RequireMembership />}>
          {/* A study exactly as seekers see it (full-screen reader, no saving). */}
          <Route element={<RequireLeadership />}>
            <Route path="/leadership/studies/:studyId" element={<StudyReader preview />} />
          </Route>
          {/* Wallet cards print on their own, without the app around them. */}
          <Route path="/app/wallet-cards" element={<WalletCards />} />
          <Route element={<AuthedLayout />}>
            <Route path="/app" element={<MemberDashboard />} />
            <Route path="/app/messages" element={<Inbox />} />
            <Route path="/app/bible" element={<BibleReader base="/app/bible" />} />
            <Route path="/app/bible/:book/:chapter" element={<BibleReader base="/app/bible" />} />
            <Route path="/app/bible/plans" element={<PlanList base="/app/bible" />} />
            <Route path="/app/bible/plans/:planId" element={<PlanPage base="/app/bible" />} />
            <Route path="/app/messages/:conversationId" element={<Thread />} />

            <Route element={<RequireLeadership />}>
              <Route path="/leadership/overview" element={<Overview />} />
              <Route path="/leadership/content" element={<Content />} />
              <Route path="/leadership/resources" element={<Resources />} />
              <Route
                path="/leadership/study-editor"
                element={<StudyLibrary base="/leadership/study-editor" bank={false} />}
              />
              <Route path="/leadership/study-editor/:studyId" element={<StudyEditor base="/leadership/study-editor" />} />
              <Route
                path="/leadership/reading-plans"
                element={<PlanLibrary base="/leadership/reading-plans" bank={false} />}
              />
              <Route path="/leadership/reading-plans/:planId" element={<PlanEditor base="/leadership/reading-plans" />} />
              <Route path="/leadership/faith-in-action" element={<PromptLibrary bank={false} />} />
              <Route path="/leadership/people" element={<People />} />
              <Route element={<RequireAccountAdmin />}>
                <Route path="/leadership/account" element={<AccountSettings />} />
              </Route>
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

/** A suspended account: its address is offline (docs/accounts-and-roles.md). */
function PausedAddress({ name }: { name: string }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Wordmark />
      <div className="card w-full px-6 py-8">
        <h1 className="text-xl">{name} is paused</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-strong">
          This ministry’s space isn’t available right now. Please check back later.
        </p>
      </div>
    </main>
  );
}

function UnknownAddress() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Wordmark />
      <div className="card w-full px-6 py-8">
        <h1 className="text-xl">This address isn’t set up</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-strong">
          No church or ministry uses it yet. Check the link you were given.
        </p>
        <a href={platformUrl('/')} className="mt-4 inline-block text-sm text-sage underline decoration-sage/30 underline-offset-2 hover:decoration-sage">
          Go to Ekklē
        </a>
      </div>
    </main>
  );
}

function StudyRedirect() {
  const { studyId = '' } = useParams();
  return <Navigate to={`/space/studies/${studyId}`} replace />;
}

function NotFound() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Wordmark />
      <div className="card w-full px-6 py-8">
        <h1 className="text-xl">Not found</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-strong">
          This page doesn’t exist, or it moved somewhere quieter.
        </p>
      </div>
    </main>
  );
}
