"use client";

import { SignInButton, SignUpButton } from "@clerk/nextjs";
import Link from "next/link";

import type { AccountWorkspaceState } from "@/lib/use-account-workspace";

interface ProviderSelectorBarProps {
  workspace: AccountWorkspaceState;
  publishableKey?: string | undefined;
}

export function ProviderSelectorBar({
  workspace,
  publishableKey,
}: ProviderSelectorBarProps) {
  if (workspace.usernameRequired) {
    return (
      <section className="provider-bar provider-bar-auth" role="alert">
        <div>
          <p className="eyebrow">Username Format Required</p>
          <strong>Set an 8–16 character kebab-case username to publish</strong>
          <p className="provider-bar-sub">
            Your Clerk username must match{" "}
            <code>^[a-z0-9](?:[a-z0-9-]&#123;6,14&#125;[a-z0-9])$</code> (for
            example, <code>alice-labs</code>). Update your username in your
            Clerk profile menu and reload Studio.
          </p>
        </div>
      </section>
    );
  }

  if (!workspace.authRequired) {
    return null;
  }

  return (
    <section className="provider-bar provider-bar-auth" role="status">
      <div>
        <p className="eyebrow">Account Authentication</p>
        <strong>Sign in to publish capabilities under your account</strong>
        <p className="provider-bar-sub">
          Each signed-in FACET account automatically maps to your{" "}
          <code>provider</code> handle. You can explore builders below, then
          sign in to save drafts, store secrets, or publish to Avalanche Fuji.
        </p>
      </div>
      <div className="provider-bar-actions">
        {publishableKey ? (
          <>
            <SignInButton mode="modal">
              <button type="button" className="button button-primary">
                Sign in <span aria-hidden="true">↗</span>
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button type="button" className="button button-ghost">
                Create account
              </button>
            </SignUpButton>
          </>
        ) : (
          <>
            <Link className="button button-primary" href="/sign-in">
              Sign in <span aria-hidden="true">↗</span>
            </Link>
            <Link className="button button-ghost" href="/sign-up">
              Create account
            </Link>
          </>
        )}
      </div>
    </section>
  );
}
