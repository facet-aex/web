import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

import { GET as getFaucetStatus } from "@/app/api/facet/faucet/status/route";
import { POST as postFaucetClaim } from "@/app/api/facet/faucet/claim/route";
import { FaucetForm } from "@/components/faucet-form";
import { SiteNav } from "@/components/site-nav";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Faucet navigation and /faucet UI", () => {
  it("renders Faucet link directly adjacent to Docs in SiteNav", () => {
    const markup = renderToStaticMarkup(<SiteNav activeSection="faucet" />);
    const docsHrefIndex = markup.indexOf('href="/docs"');
    const faucetHrefIndex = markup.indexOf('href="/faucet"');

    expect(docsHrefIndex).toBeGreaterThan(-1);
    expect(faucetHrefIndex).toBeGreaterThan(docsHrefIndex);
    const sliceBetween = markup.slice(docsHrefIndex + 12, faucetHrefIndex);
    expect(sliceBetween).not.toContain("href=");
    expect(markup).toContain(">Docs</a>");
    expect(markup).toContain("site-nav-cell-faucet");
    expect(markup).toContain("site-nav-faucet-tag");
    expect(markup).toContain(">Faucet</span>");
    expect(markup).toContain(">fUSD</span>");
    expect(markup).toContain('aria-current="page"');
  });

  it("renders address input, Faucet submit button, and Avalanche claim copy without Fuji", () => {
    const markup = renderToStaticMarkup(
      <FaucetForm
        initialStatus={{
          enabled: true,
          dripAtomic: "1000000",
          addressCooldownSec: 86_400,
        }}
      />,
    );

    expect(markup).toContain("Avalanche");
    expect(markup).toContain("fUSD");
    expect(markup).toContain("<input");
    expect(markup).toContain(">Faucet</button>");
    expect(markup).toContain("Claim");
    expect(markup).not.toMatch(/\bfuji\b/iu);
  });

  it("renders disabled notice when faucet status is disabled without Fuji wording", () => {
    const markup = renderToStaticMarkup(
      <FaucetForm
        initialStatus={{
          enabled: false,
          dripAtomic: "1000000",
          addressCooldownSec: 86_400,
        }}
      />,
    );

    expect(markup).toContain("temporarily unavailable");
    expect(markup).not.toMatch(/\bfuji\b/iu);
  });

  it("forwards public faucet claim requests with client IP without Clerk auth and preserves 200 and 429", async () => {
    vi.stubEnv("FACET_CONTROL_API_URL", "https://control.example");
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            address: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
            amountAtomic: "1000000",
            balanceAtomic: "2000000",
            txHash: `0x${"a".repeat(64)}`,
            explorerUrl: `https://testnet.snowtrace.io/tx/0x${"a".repeat(64)}`,
            nextClaimAt: "2026-11-21T00:00:00.000Z",
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: {
              code: "FAUCET_COOLDOWN",
              message: "Try again later.",
              details: { nextClaimAt: "2026-11-21T00:00:00.000Z" },
            },
          }),
          { status: 429, headers: { "content-type": "application/json" } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            enabled: true,
            dripAtomic: "1000000",
            addressCooldownSec: 86_400,
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const req1 = new Request(
      "https://facet.briandev.space/api/facet/faucet/claim",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-forwarded-for": "203.0.113.55",
        },
        body: JSON.stringify({
          address: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
        }),
      },
    );
    const res1 = await postFaucetClaim(req1);
    expect(res1.status).toBe(200);
    expect(await res1.json()).toMatchObject({ amountAtomic: "1000000" });

    const [upstreamUrl, upstreamInit] = fetchMock.mock.calls[0] as [
      URL | string,
      RequestInit,
    ];
    expect(String(upstreamUrl)).toBe("https://control.example/v1/faucet/claim");
    const forwardedHeaders = new Headers(upstreamInit.headers);
    expect(forwardedHeaders.get("x-forwarded-for")).toBe("203.0.113.55");
    expect(forwardedHeaders.has("authorization")).toBe(false);

    const req2 = new Request(
      "https://facet.briandev.space/api/facet/faucet/claim",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address: "0x9265c1c87fC5fb3C72Dc68b4D3A005dE1E22C3cf",
        }),
      },
    );
    const res2 = await postFaucetClaim(req2);
    expect(res2.status).toBe(429);

    const statusRes = await getFaucetStatus();
    expect(statusRes.status).toBe(200);
    expect(await statusRes.json()).toEqual({
      enabled: true,
      dripAtomic: "1000000",
      addressCooldownSec: 86_400,
    });
  });
});
