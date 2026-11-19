"use client";

import { useCallback, useEffect, useState } from "react";

export interface CurrentAccountUser {
  clerkId: string;
  username: string;
  walletAddress: string | null;
  walletVerifiedAt: string | null;
  status: "active" | "disabled";
}

export interface AccountWorkspaceState {
  user: CurrentAccountUser | null;
  username: string;
  walletAddress: string | null;
  walletVerified: boolean;
  loading: boolean;
  authRequired: boolean;
  usernameRequired: boolean;
  error: string | null;
  refresh: () => Promise<CurrentAccountUser | null>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseUser(value: unknown): CurrentAccountUser | null {
  if (!isRecord(value) || !isRecord(value.user)) return null;
  const user = value.user;
  if (
    typeof user.clerkId !== "string" ||
    typeof user.username !== "string" ||
    (user.status !== "active" && user.status !== "disabled")
  ) {
    return null;
  }
  return {
    clerkId: user.clerkId,
    username: user.username,
    walletAddress:
      typeof user.walletAddress === "string" ? user.walletAddress : null,
    walletVerifiedAt:
      typeof user.walletVerifiedAt === "string" ? user.walletVerifiedAt : null,
    status: user.status,
  };
}

interface AccountSnapshot {
  user: CurrentAccountUser | null;
  authRequired: boolean;
  usernameRequired: boolean;
  error: string | null;
}

async function fetchAccountSnapshot(
  signal?: AbortSignal,
): Promise<AccountSnapshot | null> {
  try {
    const response = await fetch("/api/facet/me", {
      cache: "no-store",
      ...(signal ? { signal } : {}),
    });
    const body = (await response.json().catch(() => null)) as unknown;
    if (signal?.aborted) return null;

    if (response.status === 401) {
      return {
        user: null,
        authRequired: true,
        usernameRequired: false,
        error: null,
      };
    }
    if (
      response.status === 409 &&
      isRecord(body) &&
      isRecord(body.error) &&
      body.error.code === "USERNAME_REQUIRED"
    ) {
      return {
        user: null,
        authRequired: false,
        usernameRequired: true,
        error:
          typeof body.error.message === "string"
            ? body.error.message
            : "Set an 8-16 character kebab-case username in Clerk before publishing.",
      };
    }
    if (!response.ok) {
      const message =
        isRecord(body) &&
        isRecord(body.error) &&
        typeof body.error.message === "string"
          ? body.error.message
          : "Unable to load your FACET account.";
      return {
        user: null,
        authRequired: false,
        usernameRequired: false,
        error: message,
      };
    }
    return {
      user: parseUser(body),
      authRequired: false,
      usernameRequired: false,
      error: null,
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return null;
    }
    return {
      user: null,
      authRequired: false,
      usernameRequired: false,
      error:
        err instanceof Error
          ? err.message
          : "Unable to load your FACET account.",
    };
  }
}

export function useAccountWorkspace(): AccountWorkspaceState {
  const [user, setUser] = useState<CurrentAccountUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [usernameRequired, setUsernameRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: AccountSnapshot) => {
    setUser(snapshot.user);
    setAuthRequired(snapshot.authRequired);
    setUsernameRequired(snapshot.usernameRequired);
    setError(snapshot.error);
    setLoading(false);
  }, []);

  const refresh = useCallback(async () => {
    const snapshot = await fetchAccountSnapshot();
    if (!snapshot) return null;
    applySnapshot(snapshot);
    return snapshot.user;
  }, [applySnapshot]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchAccountSnapshot(controller.signal).then((snapshot) => {
      if (snapshot && !controller.signal.aborted) {
        applySnapshot(snapshot);
      }
    });
    return () => controller.abort();
  }, [applySnapshot]);

  return {
    user,
    username: user?.username ?? "",
    walletAddress: user?.walletAddress ?? null,
    walletVerified: Boolean(user?.walletAddress && user?.walletVerifiedAt),
    loading,
    authRequired,
    usernameRequired,
    error,
    refresh,
  };
}
