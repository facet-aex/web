"use client";

import { useEffect, useRef, useState } from "react";

import { isValidEvmAddress } from "@/lib/facet-ui";
import { readErrorEnvelope } from "@/lib/openapi-import";

export interface ProviderMembership {
  provider: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
}

export interface EnsureProviderResult {
  providerId: string | null;
  authRequired: boolean;
  error: string | null;
}

interface ProviderResolutionOutcome extends EnsureProviderResult {
  memberships: ProviderMembership[];
}

const SELECTED_PROVIDER_STORAGE_KEY = "facet:selectedProviderId";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMemberships(value: unknown): ProviderMembership[] {
  if (!isRecord(value) || !Array.isArray(value.memberships)) return [];
  return value.memberships.flatMap((membership) => {
    if (!isRecord(membership) || !isRecord(membership.provider)) return [];
    const provider = membership.provider;
    if (
      typeof provider.id !== "string" ||
      typeof provider.name !== "string" ||
      typeof provider.slug !== "string" ||
      typeof membership.role !== "string"
    ) {
      return [];
    }
    return [
      {
        provider: {
          id: provider.id,
          name: provider.name,
          slug: provider.slug,
        },
        role: membership.role,
      },
    ];
  });
}

function readStoredProviderId(): string {
  try {
    return window.sessionStorage.getItem(SELECTED_PROVIDER_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

function writeStoredProviderId(id: string): void {
  try {
    if (id) {
      window.sessionStorage.setItem(SELECTED_PROVIDER_STORAGE_KEY, id);
    } else {
      window.sessionStorage.removeItem(SELECTED_PROVIDER_STORAGE_KEY);
    }
  } catch {
    // Ignore storage unavailability
  }
}

function generatePersonalProviderSlug(): string {
  const randomSuffix =
    typeof globalThis.crypto?.randomUUID === "function"
      ? globalThis.crypto.randomUUID().replace(/-/gu, "").slice(0, 10)
      : Math.random().toString(16).slice(2, 12).padEnd(8, "0");
  return `studio-${randomSuffix.toLowerCase()}`;
}

async function requestOrProvisionProvider(
  walletAddress?: string,
  signal?: AbortSignal,
): Promise<ProviderResolutionOutcome> {
  const listResponse = await fetch("/api/facet/providers", {
    cache: "no-store",
    ...(signal ? { signal } : {}),
  });
  const listBody = (await listResponse.json().catch(() => null)) as unknown;

  if (listResponse.status === 401) {
    return {
      providerId: null,
      authRequired: true,
      error: null,
      memberships: [],
    };
  }
  if (!listResponse.ok) {
    return {
      providerId: null,
      authRequired: false,
      error: readErrorEnvelope(listBody),
      memberships: [],
    };
  }

  const existing = readMemberships(listBody);
  if (existing.length > 0) {
    const storedId = readStoredProviderId();
    const chosen =
      existing.find((m) => m.provider.id === storedId) ?? existing[0]!;
    return {
      providerId: chosen.provider.id,
      authRequired: false,
      error: null,
      memberships: existing,
    };
  }

  const payload: Record<string, string> = {
    name: "Personal Studio",
    slug: generatePersonalProviderSlug(),
  };
  if (walletAddress?.trim() && isValidEvmAddress(walletAddress)) {
    payload.walletAddress = walletAddress.trim();
  }

  const createResponse = await fetch("/api/facet/providers", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    ...(signal ? { signal } : {}),
  });
  const createBody = (await createResponse.json().catch(() => null)) as unknown;

  if (createResponse.status === 401) {
    return {
      providerId: null,
      authRequired: true,
      error: null,
      memberships: [],
    };
  }
  if (!createResponse.ok) {
    return {
      providerId: null,
      authRequired: false,
      error: readErrorEnvelope(createBody),
      memberships: [],
    };
  }
  if (
    !isRecord(createBody) ||
    !isRecord(createBody.provider) ||
    typeof createBody.provider.id !== "string" ||
    typeof createBody.provider.name !== "string" ||
    typeof createBody.provider.slug !== "string"
  ) {
    return {
      providerId: null,
      authRequired: false,
      error: "The Control API returned invalid provider details.",
      memberships: [],
    };
  }

  const created: ProviderMembership = {
    provider: {
      id: createBody.provider.id,
      name: createBody.provider.name,
      slug: createBody.provider.slug,
    },
    role: "owner",
  };
  return {
    providerId: created.provider.id,
    authRequired: false,
    error: null,
    memberships: [created],
  };
}

export interface ProviderWorkspaceState {
  memberships: ProviderMembership[];
  providerId: string;
  loading: boolean;
  authRequired: boolean;
  error: string | null;
  ensureProvider: (walletAddress?: string) => Promise<EnsureProviderResult>;
}

export function useProviderWorkspace(): ProviderWorkspaceState {
  const [memberships, setMemberships] = useState<ProviderMembership[]>([]);
  const [providerId, setProviderIdState] = useState("");
  const [loading, setLoading] = useState(true);
  const [authRequired, setAuthRequired] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inFlightEnsure = useRef<Promise<EnsureProviderResult> | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const applyOutcome = (
      outcome: ProviderResolutionOutcome,
    ): EnsureProviderResult => {
      if (outcome.providerId) {
        setMemberships(outcome.memberships);
        setProviderIdState(outcome.providerId);
        writeStoredProviderId(outcome.providerId);
        setAuthRequired(false);
        setError(null);
      } else {
        setAuthRequired(outcome.authRequired);
        setError(outcome.error);
      }
      return {
        providerId: outcome.providerId,
        authRequired: outcome.authRequired,
        error: outcome.error,
      };
    };

    const initialPromise = requestOrProvisionProvider(
      undefined,
      controller.signal,
    )
      .then((outcome) => {
        if (controller.signal.aborted) {
          return { providerId: null, authRequired: false, error: null };
        }
        return applyOutcome(outcome);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") {
          return { providerId: null, authRequired: false, error: null };
        }
        const message =
          err instanceof Error
            ? err.message
            : "Your provider workspace could not be initialized.";
        setError(message);
        return { providerId: null, authRequired: false, error: message };
      })
      .finally(() => {
        if (inFlightEnsure.current === initialPromise) {
          inFlightEnsure.current = null;
        }
        if (!controller.signal.aborted) setLoading(false);
      });

    inFlightEnsure.current = initialPromise;

    return () => controller.abort();
  }, []);

  async function ensureProvider(
    walletAddress?: string,
  ): Promise<EnsureProviderResult> {
    if (providerId) {
      return { providerId, authRequired: false, error: null };
    }
    if (inFlightEnsure.current) {
      return inFlightEnsure.current;
    }

    const promise = requestOrProvisionProvider(walletAddress)
      .then((outcome) => {
        if (outcome.providerId) {
          setMemberships(outcome.memberships);
          setProviderIdState(outcome.providerId);
          writeStoredProviderId(outcome.providerId);
          setAuthRequired(false);
          setError(null);
        } else {
          setAuthRequired(outcome.authRequired);
          setError(outcome.error);
        }
        return {
          providerId: outcome.providerId,
          authRequired: outcome.authRequired,
          error: outcome.error,
        };
      })
      .catch((err) => {
        const message =
          err instanceof Error
            ? err.message
            : "Your provider workspace could not be initialized.";
        setError(message);
        return { providerId: null, authRequired: false, error: message };
      })
      .finally(() => {
        if (inFlightEnsure.current === promise) {
          inFlightEnsure.current = null;
        }
      });

    inFlightEnsure.current = promise;
    return promise;
  }

  return {
    memberships,
    providerId,
    loading,
    authRequired,
    error,
    ensureProvider,
  };
}
