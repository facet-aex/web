import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { StudioFacetPreviewCard } from "@/components/studio-facet-preview-card";
import { FUJI_CHAIN_ID, FUJI_CONTRACTS } from "@/lib/facet-ui";
import {
  normalizePricingOptions,
  toCreatePricingOptions,
  validatePricingDrafts,
  type PricingOptionDraft,
} from "@/lib/pricing-types";

describe("shared multi-pricing validation and StudioFacetPreviewCard extensions", () => {
  it("enforces at least one option, unique models, positive fUSD price, maxItemsCap 1..1000, and deposit cap", () => {
    expect(validatePricingDrafts([])).not.toBeNull();

    const duplicate: PricingOptionDraft[] = [
      { model: "PAY_PER_RUN", priceFusd: "0.001", isPrimary: true },
      { model: "PAY_PER_RUN", priceFusd: "0.002", isPrimary: false },
    ];
    expect(validatePricingDrafts(duplicate)).toMatch(/duplicate|unique/iu);

    const zeroPrice: PricingOptionDraft[] = [
      { model: "PAY_PER_RUN", priceFusd: "0", isPrimary: true },
    ];
    expect(validatePricingDrafts(zeroPrice)).not.toBeNull();

    const tooManyDecimals: PricingOptionDraft[] = [
      { model: "PAY_PER_RUN", priceFusd: "0.0000001", isPrimary: true },
    ];
    expect(validatePricingDrafts(tooManyDecimals)).not.toBeNull();

    const badCapLow: PricingOptionDraft[] = [
      {
        model: "PAY_PER_RESULT",
        priceFusd: "0.001",
        maxItemsCap: 0,
        isPrimary: true,
      },
    ];
    expect(validatePricingDrafts(badCapLow)).not.toBeNull();

    const badCapHigh: PricingOptionDraft[] = [
      {
        model: "PAY_PER_RESULT",
        priceFusd: "0.001",
        maxItemsCap: 1001,
        isPrimary: true,
      },
    ];
    expect(validatePricingDrafts(badCapHigh)).not.toBeNull();

    const exceedsDeposit: PricingOptionDraft[] = [
      {
        model: "PAY_PER_RESULT",
        priceFusd: "1.5",
        maxItemsCap: 10,
        isPrimary: true,
      },
    ];
    expect(validatePricingDrafts(exceedsDeposit, "10000000")).toMatch(
      /deposit|cap|exceed/iu,
    );

    const validBoth: PricingOptionDraft[] = [
      { model: "PAY_PER_RUN", priceFusd: "0.002", isPrimary: false },
      {
        model: "PAY_PER_RESULT",
        priceFusd: "0.0005",
        maxItemsCap: 20,
        isPrimary: false,
      },
    ];
    expect(validatePricingDrafts(validBoth, "10000000")).toBeNull();

    const serialized = toCreatePricingOptions(validBoth);
    expect(serialized).toEqual([
      { model: "PAY_PER_RUN", priceAtomic: "2000", isPrimary: true },
      {
        model: "PAY_PER_RESULT",
        priceAtomic: "500",
        maxItemsCap: 20,
        isPrimary: false,
      },
    ]);
  });

  it("normalizes legacy single pricing and multi-option pricing cleanly", () => {
    const normalized = normalizePricingOptions(
      {
        model: "PAY_PER_RUN",
        priceAtomic: "1000",
        assetAddress: FUJI_CONTRACTS.fusd,
        chainId: FUJI_CHAIN_ID,
        payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
      },
      undefined,
    );
    expect(normalized).toEqual([
      {
        model: "PAY_PER_RUN",
        priceAtomic: "1000",
        maxAmountAtomic: "1000",
        assetAddress: FUJI_CONTRACTS.fusd,
        chainId: FUJI_CHAIN_ID,
        payTo: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
        isPrimary: true,
      },
    ]);
  });

  it("renders multi-pricing lines and API metadata with Payout Wallet in StudioFacetPreviewCard", () => {
    const markup = renderToStaticMarkup(
      createElement(StudioFacetPreviewCard, {
        facetType: "API",
        provider: "alice-labs",
        facetDisplayName: "GitHub Search",
        facetName: "github-search",
        version: "1.0.0",
        category: "data",
        tags: ["github"],
        summary: "Searches public GitHub repositories.",
        description: "Full HTTP search endpoint.",
        pricingModel: "PAY_PER_RUN",
        priceAtomic: "1000",
        pricingOptions: [
          { model: "PAY_PER_RUN", priceFusd: "0.002", isPrimary: true },
          {
            model: "PAY_PER_RESULT",
            priceFusd: "0.0005",
            maxItemsCap: 20,
            isPrimary: false,
          },
        ],
        payoutWallet: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
        apiMethod: "POST",
        apiEndpointLabel: "/search/repositories",
        liveReadinessStatus: "Ready",
      }),
    );

    expect(markup).toContain("PAY_PER_RUN");
    expect(markup).toContain("PAY_PER_RESULT");
    expect(markup).toContain("20");
    expect(markup).toContain("Payout Wallet");
    expect(markup).toContain("0x9265c1");
    expect(markup).toContain("POST");
    expect(markup).toContain("/search/repositories");
    expect(markup).toContain("Ready");
  });
});
