"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

function SignedInAccountPill() {
  const { user } = useUser();
  const handle =
    user?.username?.trim() ||
    user?.primaryEmailAddress?.emailAddress?.split("@")[0] ||
    "account";

  return (
    <div className="account-pill" title={`Account menu (@${handle})`}>
      <span className="account-status-dot" aria-hidden="true" />
      <span className="account-handle">@{handle}</span>
      <div className="account-avatar-slot">
        <UserButton
          appearance={{
            variables: {
              colorBackground: "#ffffff",
              colorForeground: "#09090b",
              colorMutedForeground: "#52525b",
              colorPrimary: "#050505",
              colorPrimaryForeground: "#dfff4f",
              colorInput: "#f4f4f5",
              colorInputForeground: "#09090b",
              borderRadius: "0px",
            },
            elements: {
              rootBox: "facet-clerk-root",
              userButtonBox: "facet-clerk-box",
              userButtonTrigger: "facet-clerk-trigger",
              avatarBox: {
                width: "28px",
                height: "28px",
                borderRadius: "2px",
                border: "1px solid #dfff4f",
              },
              userButtonPopoverCard: {
                width: "240px",
                minWidth: "220px",
                maxWidth: "calc(100vw - 2rem)",
                backgroundColor: "#ffffff",
                border: "1px solid #18181b",
                borderRadius: "0px",
                boxShadow: "0 20px 48px rgba(0, 0, 0, 0.52)",
              },
              userButtonPopoverMain: {
                backgroundColor: "#ffffff",
              },
              userButtonPopoverFooter: {
                backgroundColor: "#f8f8f5",
                borderTop: "1px solid #e4e4e7",
              },
            },
          }}
        />
      </div>
      <span className="account-chevron" aria-hidden="true">
        ▾
      </span>
    </div>
  );
}

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
          <button
            type="button"
            className="environment auth-pill auth-pill-primary"
          >
            Sign up
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <SignedInAccountPill />
      </Show>
    </div>
  );
}
