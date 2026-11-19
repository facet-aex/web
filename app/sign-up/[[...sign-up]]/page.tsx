import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { Suspense } from "react";

export default function SignUpPage() {
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
        <section
          className="provider-bar provider-bar-auth"
          aria-label="FACET username format guide"
        >
          <div>
            <p className="eyebrow">Provider Handle Format</p>
            <strong>Choose an 8–16 character kebab-case username</strong>
            <p className="provider-bar-sub">
              Your Clerk username becomes your public FACET{" "}
              <code>provider</code> namespace and must match{" "}
              <code>^[a-z0-9](?:[a-z0-9-]&#123;6,14&#125;[a-z0-9])$</code> (for
              example, <code>alice-labs</code>).
            </p>
          </div>
        </section>
        <Suspense fallback={<p className="empty-state">Loading sign-up…</p>}>
          <SignUp />
        </Suspense>
      </div>
    </main>
  );
}
