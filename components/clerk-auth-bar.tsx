"use client";

import { Show, SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";

export function ClerkAuthBar({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  if (!publishableKey) {
    return <span className="environment">Avalanche Fuji</span>;
  }

  return (
    <div className="auth-controls">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button type="button" className="environment auth-pill">
            Sign in
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button type="button" className="environment auth-pill">
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <div className="environment auth-user">
          <UserButton showName />
        </div>
      </Show>
    </div>
  );
}
