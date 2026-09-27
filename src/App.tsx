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
// The cinematic homepage is code-split so GSAP/Lenis never load in the product.
const Home = lazy(() => import('@/public/home/Home'));
import ForChurches from '@/public/ForChurches';
import Offer from '@/public/Offer';

/**
 * Route map. Public: /sign-in and the recipient view /r/:slug (Sprint 3).
 * Authed member area and leadership tools sit behind guards + the shared shell.
 */
export default function App() {
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
      <Route path="/offer" element={<Offer />} />
      <Route path="/sign-in" element={<SignIn />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      {/* Recipient experience (no login) */}
      <Route path="/r/:slug" element={<RecipientExperience />} />

      {/* Your space — a seeker's own gated home. Signed out → the seeker sign-in
          (then back to the page they asked for); signed in → home, messages,
          studies (with the immersive reader), and account. */}
      <Route element={<SeekerGate />}>
        <Route path="/space/studies/:studyId" element={<StudyReader />} />
        <Route element={<SeekerLayout />}>
          <Route path="/space" element={<SpaceHome />} />
          <Route path="/space/messages" element={<Connection />} />
          <Route path="/space/studies" element={<StudyDashboard />} />
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
              <Route path="/leadership/people" element={<People />} />
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
