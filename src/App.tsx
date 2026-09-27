import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import {
  RequireAuth,
  RequireMembership,
  RequireLeadership,
  RequirePlatformAdmin,
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
import MemberDashboard from '@/routes/member/Dashboard';
import Inbox from '@/routes/member/Inbox';
import Thread from '@/routes/member/Thread';
import People from '@/routes/leadership/People';
import Content from '@/routes/leadership/Content';
import PlatformConsole from '@/routes/platform/Console';
import RecipientExperience from '@/recipient/RecipientExperience';
import SeekerGate from '@/space/SeekerGate';
import SeekerLayout from '@/space/SeekerLayout';
import StudyDashboard from '@/space/StudyDashboard';
import StudyReader from '@/space/StudyReader';
import Connection from '@/space/Connection';
import Account from '@/space/Account';
import SpaceHome from '@/space/SpaceHome';
import ResourcesLibrary from '@/space/ResourcesLibrary';
import ResourcePage from '@/space/ResourcePage';
import Resources from '@/routes/leadership/Resources';
import AccountSettings from '@/routes/leadership/AccountSettings';
// The cinematic homepage is code-split so GSAP/Lenis never load in the product.
const Home = lazy(() => import('@/public/home/Home'));
import ForChurches from '@/public/ForChurches';
import Offer from '@/public/Offer';

/**
 * Route map (docs/tenancy.md). The address decides which set applies:
 *  - ekkle.org (platform): Ekklē itself — the homepage story, For churches,
 *    the platform console. Old account links are sent on to their account.
 *  - an account's address (<sub>.ekkle.org or its own domain): member links,
 *    the offer page, Your space, and the members' & leaders' app.
 */
export default function App() {
  const account = useAccount();
  if (account.status === 'loading') return <FullPageLoading />;
  if (account.status === 'unknown') return <UnknownAddress />;
  return account.status === 'platform' ? <PlatformRoutes /> : <AccountRoutes />;
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
      <Route path="/for-churches" element={<ForChurches />} />
      {/* Not linked from the marketing pages: platform admins use /sign-in;
          members and seekers sign in on their account's own address. */}
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/find" element={<FindAccount />} />

      {/* The platform console lives on ekkle.org. */}
      <Route element={<RequireAuth />}>
        <Route element={<RequireMembership />}>
          <Route element={<AuthedLayout />}>
            <Route element={<RequirePlatformAdmin />}>
              <Route path="/platform" element={<PlatformConsole />} />
            </Route>
          </Route>
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
      <Route path="/for-churches" element={<ToPlatform />} />
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
          <Route path="/space/resources" element={<ResourcesLibrary />} />
          <Route path="/space/resources/:resourceId" element={<ResourcePage />} />
          <Route path="/space/account" element={<Account />} />
        </Route>
      </Route>
      {/* Old study-area links (emails already sent, bookmarks). */}
      <Route path="/studies" element={<Navigate to="/space/studies" replace />} />
      <Route path="/studies/connection" element={<Navigate to="/space/messages" replace />} />
      <Route path="/studies/account" element={<Navigate to="/space/account" replace />} />
      <Route path="/studies/:studyId" element={<StudyRedirect />} />

      <Route element={<RequireAuth />}>
        <Route path="/welcome" element={<Onboarding />} />

        <Route element={<RequireMembership />}>
          <Route element={<AuthedLayout />}>
            <Route path="/app" element={<MemberDashboard />} />
            <Route path="/app/messages" element={<Inbox />} />
            <Route path="/app/messages/:conversationId" element={<Thread />} />

            <Route element={<RequireLeadership />}>
              <Route path="/leadership/content" element={<Content />} />
              <Route path="/leadership/resources" element={<Resources />} />
              <Route path="/leadership/people" element={<People />} />
              <Route path="/leadership/account" element={<AccountSettings />} />
            </Route>

            <Route element={<RequirePlatformAdmin />}>
              <Route path="/platform" element={<PlatformConsole />} />
            </Route>
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
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
        <a href={platformUrl('/')} className="mt-4 inline-block text-sm text-sage underline-offset-2 hover:underline">
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
