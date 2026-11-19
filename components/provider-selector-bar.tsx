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
          <strong>Update your username to publish on FACET</strong>
          <p className="provider-bar-sub">
            Use 8–16 lowercase letters (a–z), numbers (0–9), and hyphens (-)
            only (for example, <code>alice-labs</code>; underscores are not
            allowed). Update your username in your Clerk profile menu and
            reload.
          </p>
        </div>
      </section>
    );
  }

  if (workspace.error && !workspace.authRequired) {
    return (
      <section className="provider-bar provider-bar-auth" role="alert">
        <div>
          <p className="eyebrow">Account Sync Error</p>
          <strong>Could not load your FACET account</strong>
          <p className="provider-bar-sub">{workspace.error}</p>
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
