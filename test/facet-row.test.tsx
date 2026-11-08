import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { FacetRow } from "@/components/facet-row";
import { demoFacets } from "@/lib/demo-facets";

describe("FacetRow", () => {
  it("exposes provider, interface and lifecycle status without relying on color alone", () => {
    const facet = demoFacets[0];
    if (!facet) throw new Error("Expected demo fixture");

    const markup = renderToStaticMarkup(<FacetRow facet={facet} />);

    expect(markup).toContain("Northstar Labs");
    expect(markup).toContain("Published");
    expect(markup).toContain("Bearer");
    expect(markup).toContain('aria-label="Inspect Avalanche token snapshot"');
  });
});
