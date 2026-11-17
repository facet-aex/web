import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";

export default function SignInPage() {
  return (
    <main className="auth-page">
      <div className="auth-nav-links">
        <Link className="back-link" href="/">
          ← FACET Home
        </Link>
        <Link className="back-link" href="/store">
          Facet Store
        </Link>
        <Link className="back-link" href="/studio">
          Studio
        </Link>
      </div>
      <div className="auth-card-slot">
        <Suspense fallback={<p className="empty-state">Loading sign-in…</p>}>
          <SignIn />
        </Suspense>
      </div>
    </main>
  );
}
