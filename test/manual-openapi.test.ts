import { describe, expect, it } from "vitest";
import { makeManualOpenApi } from "@/lib/manual-openapi";

describe("manual API description", () => {
  it("generates an importable CoinGecko GET description without a secret value", () => {
    const document = JSON.parse(
      makeManualOpenApi({
        title: "Bitcoin price history",
        endpointUrl: "https://api.coingecko.com/api/v3/coins/{id}/market_chart",
        summary: "Get historical Bitcoin prices",
        queryNames: "vs_currency, days",
        apiKeyHeader: "x-cg-demo-api-key",
      }),
    );
    expect(document.servers[0].url).toBe("https://api.coingecko.com");
    expect(
      document.paths["/api/v3/coins/{id}/market_chart"].get.parameters,
    ).toHaveLength(3);
    expect(document.components.securitySchemes.demoApiKey.name).toBe(
      "x-cg-demo-api-key",
    );
  });

  it("rejects non-HTTPS and inline credentials", () => {
    expect(() =>
      makeManualOpenApi({
        title: "x",
        endpointUrl: "http://localhost/data",
        summary: "x",
        queryNames: "",
        apiKeyHeader: "",
      }),
    ).toThrow();
  });
});
