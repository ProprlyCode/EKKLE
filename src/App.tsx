import { Routes, Route, Navigate } from 'react-router-dom';
import { Wordmark } from '@/components/Wordmark';

/**
 * App shell + routing.
 *
 * Sprint 1 lays down the route map with branded placeholders. Real screens land
 * per sprint:
 *   - /sign-in, /app (member), /leadership   → Sprint 2
 *   - /r/:slug (recipient experience)         → Sprint 3
 */

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col items-center justify-center gap-6 px-4 py-16 text-center">
      <Wordmark withTagline />
      <div className="card w-full px-6 py-8">
        <h1 className="text-xl">{title}</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted-strong">{note}</p>
      </div>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/sign-in" replace />} />
      <Route
        path="/sign-in"
        element={
          <Placeholder
            title="Welcome"
            note="Sign-in for members and leaders arrives in the next sprint."
          />
        }
      />
      <Route
        path="/r/:slug"
        element={
          <Placeholder
            title="A moment shared with you"
            note="The guided welcome experience arrives in a later sprint."
          />
        }
      />
      <Route
        path="*"
        element={
          <Placeholder
            title="Not found"
            note="This page doesn’t exist, or it moved somewhere quieter."
          />
        }
      />
    </Routes>
  );
}
