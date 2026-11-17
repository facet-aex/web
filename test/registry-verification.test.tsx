import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import FacetDetailPage from "@/app/facets/[facetId]/page";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("published Facet registry verification", () => {
  it("lets a provider verify an already-published Actor after reopening its detail page", async () => {
    const facetId = "01a1e97b-a5d1-7c25-9a05-4e0e7405d445";
    vi.stubEnv("FACET_CONTROL_API_URL", "http://127.0.0.1:4000");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          facet: {
            id: facetId,
            versionId: "01a1e97b-a5d1-7c2d-a50a-7f231c809d73",
            slug: "vn-tech-news-actor",
            name: "VN Tech News Actor",
            description: "Extracts sourced articles.",
            category: "vietnamese-data",
            tags: ["vietnam"],
            facetType: "HOSTED_ACTOR",
            provider: {
              id: "provider-1",
              name: "Personal Studio",
              slug: "personal-studio",
            },
            displayVersion: "1.0.0",
            method: "POST",
            inputSchema: { type: "object", properties: {} },
            outputSchema: { type: "array" },
            pricing: {
              model: "PAY_PER_RESULT",
              priceAtomic: "500",
              assetAddress: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
              chainId: 43113,
              payTo: "0x5189c4C1a14Dc1a6845425B6C44D2B40c0b4f39B",
            },
            actorMeta: {
              runtime: "nodejs22-alpine-v1",
              imageDigest:
                "sha256:a1704bcec22586cba42100be2609b21362b4a17a6982508a6bf8cca5cf061731",
              registryVerified: false,
            },
            publishedAt: "2026-11-17T00:00:00.000Z",
          },
        }),
      ),
    );

    const markup = renderToStaticMarkup(
      await FacetDetailPage({ params: Promise.resolve({ facetId }) }),
    );

    expect(markup).toContain('id="registry-verify-tx"');
    expect(markup).toContain("Verify Fuji registry transaction");
  });
});
