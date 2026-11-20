import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { MyFacetsView } from "@/components/my-facets-view";
import {
  PublishRedirectToast,
  buildMyFacetsRedirectHref,
} from "@/components/publish-redirect-toast";

describe("MyFacetsView and PublishRedirectToast", () => {
  it("builds Option B /my-facets redirect URLs with submitted metadata", () => {
    const href = buildMyFacetsRedirectHref({
      provider: "brian-gemini",
      facetName: "html-product-extractor",
      version: "1.0.0",
      status: "REGISTRATION_PENDING",
      facetType: "ACTOR",
    });

    expect(href).toBe(
      "/my-facets?submitted=brian-gemini%2Fhtml-product-extractor%401.0.0&status=REGISTRATION_PENDING&type=ACTOR",
    );
  });

  it("renders PublishRedirectToast for pending and published states without banned words", () => {
    const pendingMarkup = renderToStaticMarkup(
      <PublishRedirectToast
        identifier="brian-gemini/html-product-extractor@1.0.0"
        facetType="ACTOR"
        status="REGISTRATION_PENDING"
        targetHref="/my-facets?submitted=brian-gemini%2Fhtml-product-extractor%401.0.0&status=REGISTRATION_PENDING&type=ACTOR"
        redirecting={true}
      />,
    );

    expect(pendingMarkup).toContain('data-status="REGISTRATION_PENDING"');
    expect(pendingMarkup).toContain(
      "Publish request sent — Registration Pending",
    );
    expect(pendingMarkup).toContain(
      "brian-gemini/html-product-extractor@1.0.0",
    );
    expect(pendingMarkup).toContain("Go to My Facets");
    expect(pendingMarkup).not.toMatch(/apify|rapidapi|erc-?8004/iu);

    const publishedMarkup = renderToStaticMarkup(
      <PublishRedirectToast
        identifier="brian-gemini/market-agent@1.0.0"
        facetType="AGENT"
        status="PUBLISHED"
        targetHref="/my-facets?submitted=brian-gemini%2Fmarket-agent%401.0.0&status=PUBLISHED&type=AGENT"
        redirecting={true}
      />,
    );

    expect(publishedMarkup).toContain('data-status="PUBLISHED"');
    expect(publishedMarkup).toContain("Published successfully");
    expect(publishedMarkup).toContain("Go to My Facets");
    expect(publishedMarkup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });

  it("renders MyFacetsView with pending submission banner and Avalanche copy without Fuji", () => {
    const markup = renderToStaticMarkup(
      <MyFacetsView
        initialSubmitted="brian-gemini/html-product-extractor@1.0.0"
        initialStatus="REGISTRATION_PENDING"
        initialType="ACTOR"
      />,
    );

    expect(markup).toContain("My Facets");
    expect(markup).toContain(
      "Publish request submitted — Registration Pending",
    );
    expect(markup).toContain("brian-gemini/html-product-extractor@1.0.0");
    expect(markup).toContain("Avalanche");
    expect(markup).toContain("+ Publish New Facet");
    expect(markup).toContain('href="/studio"');
    expect(markup).not.toMatch(/\bfuji\b/iu);
    expect(markup).not.toMatch(/apify|rapidapi|erc-?8004/iu);
  });
});
