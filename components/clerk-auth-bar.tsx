"use client";

import { useEffect, useState } from "react";

interface ClerkWindow extends Window {
  Clerk?: {
    load: () => Promise<void>;
    user?: {
      primaryEmailAddress?: { emailAddress?: string };
      username?: string;
    } | null;
    openSignIn: () => void;
    signOut: () => Promise<void>;
  };
}

function decodeClerkFrontendApi(publishableKey: string): string | null {
  const parts = publishableKey.split("_");
  const encoded = parts[2];
  if (!encoded) return null;
  try {
    const decoded = atob(encoded).replace(/\$$/u, "");
    return decoded ? `https://${decoded}` : null;
  } catch {
    return null;
  }
}

export function ClerkAuthBar({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  const [status, setStatus] = useState<"idle" | "signed-out" | "signed-in">(
    "idle",
  );
  const [label, setLabel] = useState<string>("");

  useEffect(() => {
    if (!publishableKey) return;
    const frontendApi = decodeClerkFrontendApi(publishableKey);
    if (!frontendApi) return;

    const w = window as ClerkWindow;
    const initClerk = async () => {
      if (!w.Clerk) return;
      await w.Clerk.load();
      if (w.Clerk.user) {
        setStatus("signed-in");
        setLabel(
          w.Clerk.user.primaryEmailAddress?.emailAddress ??
            w.Clerk.user.username ??
            "Provider",
        );
      } else {
        setStatus("signed-out");
      }
    };

    if (w.Clerk) {
      void initClerk();
      return;
    }

    const script = document.createElement("script");
    script.src = `${frontendApi}/npm/@clerk/clerk-js@5/dist/clerk.browser.js`;
    script.async = true;
    script.crossOrigin = "anonymous";
    script.setAttribute("data-clerk-publishable-key", publishableKey);
    script.onload = () => void initClerk();
    document.head.appendChild(script);
  }, [publishableKey]);

  if (!publishableKey) {
    return <span className="environment">Avalanche Fuji</span>;
  }

  const w = typeof window !== "undefined" ? (window as ClerkWindow) : null;

  if (status === "signed-in") {
    return (
      <button
        type="button"
        className="environment auth-pill"
        onClick={() =>
          void w?.Clerk?.signOut().then(() => window.location.reload())
        }
        title="Sign out of Clerk"
      >
        {label} · Sign out
      </button>
    );
  }

  return (
    <button
      type="button"
      className="environment auth-pill"
      onClick={() => w?.Clerk?.openSignIn()}
    >
      Sign in (Clerk)
    </button>
  );
}
