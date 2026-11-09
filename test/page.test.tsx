import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import HomePage from "@/app/page";

describe("HomePage Provider Console integration", () => {
  it("links to and renders the live import workspace without stale fetch claims", () => {
    const markup = renderToStaticMarkup(<HomePage />);

    expect(markup).toContain('href="#provider-console"');
    expect(markup).toContain('src="/facet-logo.svg"');
    expect(markup).toContain('id="provider-console"');
    expect(markup).toContain("Fetched by FACET&#x27;s isolated HTTPS fetcher.");
    expect(markup).not.toContain("Remote fetching is not enabled yet.");
  });
});
