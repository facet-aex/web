"use client";

import {
  Show,
  SignInButton,
  SignUpButton,
  UserButton,
  useUser,
} from "@clerk/nextjs";

function MyFacetsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <rect x="2" y="2.5" width="5" height="5" />
      <rect x="9" y="2.5" width="5" height="5" />
      <rect x="2" y="9" width="5" height="5" />
      <rect x="9" y="9" width="5" height="5" />
    </svg>
  );
}

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
        >
          <UserButton.MenuItems>
            <UserButton.Action label="manageAccount" />
            <UserButton.Link
              label="My Facets"
              labelIcon={<MyFacetsIcon />}
              href="/my-facets"
            />
            <UserButton.Action label="signOut" />
          </UserButton.MenuItems>
        </UserButton>
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
    return <span className="environment">Avalanche</span>;
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
