"use client";

import { useEffect, useState } from "react";

import { bumpSemver, type FacetType } from "@/lib/identifiers";

export interface OwnedFacetRef {
  provider: string;
  facetName: string;
  facetDisplayName: string;
  facetType: FacetType;
  version: string;
  status: string;
}

export interface FacetIdentityConflict {
  kind: "TYPE_CONFLICT" | "VERSION_CONFLICT";
  message: string;
  suggestedVersion: string | null;
}

function parseSemverTuple(version: string): [number, number, number] | null {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.exec(
    version.trim(),
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function compareSemverTuple(a: string, b: string): number {
  const pa = parseSemverTuple(a);
  const pb = parseSemverTuple(b);
  if (!pa || !pb) return a.localeCompare(b);
  if (pa[0] !== pb[0]) return pa[0] - pb[0];
  if (pa[1] !== pb[1]) return pa[1] - pb[1];
  return pa[2] - pb[2];
}

/**
 * Checks whether an owned Facet identity or (facetName, version) already exists.
 */
export function checkFacetIdentityConflict(
  ownedFacets: OwnedFacetRef[],
  target: {
    facetName: string;
    version: string;
    facetType: FacetType;
  },
): FacetIdentityConflict | null {
  const name = target.facetName.trim().toLowerCase();
  const ver = target.version.trim();
  if (!name) return null;

  const sameName = ownedFacets.filter(
    (item) => item.facetName.toLowerCase() === name,
  );
  if (sameName.length === 0) return null;

  const otherType = sameName.find(
    (item) => item.facetType !== target.facetType,
  );
  if (otherType) {
    return {
      kind: "TYPE_CONFLICT",
      message: `Facet Name "${name}" is already used by your ${otherType.facetType} Facet. Choose a different Facet Name.`,
      suggestedVersion: null,
    };
  }

  const exactMatch = sameName.find((item) => item.version.trim() === ver);
  if (!exactMatch) return null;

  let highest = sameName[0]!.version;
  for (const item of sameName) {
    if (compareSemverTuple(item.version, highest) > 0) {
      highest = item.version;
    }
  }
  const suggestedVersion = bumpSemver(highest, "patch");
  const ownerPrefix = exactMatch.provider ? `${exactMatch.provider}/` : "";

  return {
    kind: "VERSION_CONFLICT",
    message: `${ownerPrefix}${name}@${ver} already exists (${exactMatch.status}). Change Facet Name or bump version to ${suggestedVersion}.`,
    suggestedVersion,
  };
}

export function useOwnedFacets(
  username: string | null | undefined,
  refreshKey?: string | number,
): OwnedFacetRef[] {
  const [loaded, setLoaded] = useState<{
    username: string;
    items: OwnedFacetRef[];
  } | null>(null);

  useEffect(() => {
    if (!username) return;
    const currentUsername = username;
    const controller = new AbortController();

    async function loadOwned() {
      try {
        const res = await fetch("/api/facet/facets/mine", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (res.status === 404) {
          const actorRes = await fetch("/api/facet/actors/mine", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!actorRes.ok) return;
          const actorBody = (await actorRes.json()) as {
            actors?: Array<{
              provider: string;
              facetName: string;
              facetDisplayName: string;
              version: string;
              status: string;
            }>;
          };
          if (!controller.signal.aborted) {
            setLoaded({
              username: currentUsername,
              items: (actorBody.actors ?? []).map((actor) => ({
                ...actor,
                facetType: "ACTOR" as const,
              })),
            });
          }
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { facets?: OwnedFacetRef[] };
        if (!controller.signal.aborted) {
          setLoaded({
            username: currentUsername,
            items: body.facets ?? [],
          });
        }
      } catch {
        /* Network errors leave list unchanged cleanly. */
      }
    }

    void loadOwned();
    return () => controller.abort();
  }, [username, refreshKey]);

  return username && loaded?.username === username ? loaded.items : [];
}
