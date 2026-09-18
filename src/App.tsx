import { Routes, Route, Navigate } from 'react-router-dom';
import {
  RequireAuth,
  RequireMembership,
  RequireLeadership,
  AuthedLayout,
} from '@/auth/guards';
import { Wordmark } from '@/components/Wordmark';
import SignIn from '@/routes/SignIn';
import Onboarding from '@/routes/Onboarding';
import MemberDashboard from '@/routes/member/Dashboard';
import Inbox from '@/routes/member/Inbox';
import Thread from '@/routes/member/Thread';
import People from '@/routes/leadership/People';
import Content from '@/routes/leadership/Content';
import RecipientExperience from '@/recipient/RecipientExperience';

/**
 * Route map. Public: /sign-in and the recipient view /r/:slug (Sprint 3).
 * Authed member area and leadership tools sit behind guards + the shared shell.
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/sign-in" element={<SignIn />} />

      {/* Recipient experience (no login) */}
      <Route path="/r/:slug" element={<RecipientExperience />} />

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
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
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
