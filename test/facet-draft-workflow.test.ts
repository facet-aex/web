import { describe, expect, it } from "vitest";

import {
  buildDraftSelections,
  readFacetDraftsResponse,
  readFacetValidationResponse,
  readFacetPublicationResponse,
  requiresManualAuthReview,
  suggestEndpoint,
} from "@/lib/facet-draft-workflow";
import type { OperationCandidate } from "@/lib/openapi-import";

const operation: OperationCandidate = {
  id: "019a69b8-1f36-7a12-9ea4-777f09a777ef",
  jsonPointer: "#/paths/~1repos~1{owner}~1{repo}/get",
  operationId: "getRepo",
  method: "GET",
  path: "/repos/{owner}/{repo}",
  summary: "Get a repository",
  normalizedCandidate: {
    normalized: {
      servers: [
        {
          url: "https://{region}.api.example.com/v1",
          variables: { region: "us" },
        },
      ],
      authAlternatives: [
        {
          schemes: [
            {
              kind: "API_KEY_HEADER",
              parameterName: "X-Api-Key",
            },
          ],
        },
      ],
    },
  },
  warnings: [],
};

describe("Facet draft workflow helpers", () => {
  it("builds deterministic editable defaults from selected operations", () => {
    expect(buildDraftSelections([operation])).toEqual([
      {
        operationCandidateId: operation.id,
        slug: "get-repo",
        name: "Get a repository",
        summary: "Get a repository",
        description: "",
        category: "api",
        tags: [],
        sideEffectClass: "READ_ONLY",
      },
    ]);
  });

  it("suggests a concrete server and unambiguous auth mapping", () => {
    expect(suggestEndpoint(operation)).toEqual({
      baseUrl: "https://us.api.example.com/v1",
      authKind: "API_KEY_HEADER",
      parameterName: "X-Api-Key",
    });
  });

  it("flags required auth that cannot be mapped without provider review", () => {
    expect(
      requiresManualAuthReview({
        ...operation,
        normalizedCandidate: {
          normalized: {
            authAlternatives: [
              { schemes: [{ kind: "UNSUPPORTED", schemeName: "oauth" }] },
            ],
          },
        },
      }),
    ).toBe(true);
    expect(requiresManualAuthReview(operation)).toBe(false);
  });

  it("rejects malformed draft and validation responses", () => {
    expect(readFacetDraftsResponse({ facets: [{ id: "bad" }] })).toBeNull();
    expect(readFacetValidationResponse({ facetVersion: {} })).toBeNull();
  });

  it("reads safe draft and warning acknowledgement metadata", () => {
    const versionId = "019a69b8-1f36-7a12-9ea4-777f09a777eb";
    const drafts = readFacetDraftsResponse({
      facets: [
        {
          id: "019a69b8-1f36-7a12-9ea4-777f09a777ea",
          slug: "get-repo",
          draftVersion: { id: versionId, version: 1 },
        },
      ],
    });
    expect(drafts?.[0]?.draftVersion.id).toBe(versionId);

    const validation = readFacetValidationResponse({
      facetVersion: {
        id: versionId,
        status: "DRAFT",
        version: 3,
        validation: {
          status: "INVALID",
          errors: [],
          warnings: [
            {
              warningId: `sha256:${"a".repeat(64)}`,
              code: "MISSING_SCHEMA",
              message: "Review schema.",
              acknowledged: false,
            },
          ],
        },
      },
    });
    expect(validation).toMatchObject({
      status: "DRAFT",
      version: 3,
      warnings: [{ code: "MISSING_SCHEMA", acknowledged: false }],
    });
  });

  it("reads publication metadata without private endpoint data", () => {
    const versionId = "019a69b8-1f36-7a12-9ea4-777f09a777eb";
    const publication = readFacetPublicationResponse({
      facet: {
        id: "019a69b8-1f36-7a12-9ea4-777f09a777ea",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        currentPublishedVersionId: versionId,
        version: 2,
      },
      facetVersion: {
        id: versionId,
        facetId: "019a69b8-1f36-7a12-9ea4-777f09a777ea",
        displayVersion: "0.1.0",
        status: "PUBLISHED",
        visibility: "PUBLIC",
        contentHash: `sha256:${"a".repeat(64)}`,
        publishedAt: "2026-11-10T00:00:00.000Z",
        version: 4,
      },
    });

    expect(publication).toMatchObject({
      versionId,
      visibility: "PUBLIC",
      version: 4,
    });
    expect(
      readFacetPublicationResponse({ facet: {}, facetVersion: {} }),
    ).toBeNull();
  });
});
