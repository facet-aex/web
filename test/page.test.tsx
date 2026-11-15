import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage Provider Console integration", () => {
  it("links to and renders the live import workspace without stale fetch claims", async () => {
    const markup = renderToStaticMarkup(
      await HomePage({ searchParams: Promise.resolve({}) }),
    );

    expect(markup).toContain('href="#provider-console"');
    expect(markup).toContain('src="/facet-logo.svg"');
    expect(markup).toContain('id="provider-console"');
    expect(markup).toContain("URL of an OpenAPI JSON/YAML document");
    expect(markup).not.toContain("Remote fetching is not enabled yet.");
  });
});
