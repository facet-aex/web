import { FaucetForm, type FaucetStatusData } from "@/components/faucet-form";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const dynamic = "force-dynamic";

const DEFAULT_STATUS: FaucetStatusData = {
  enabled: true,
  dripAtomic: "1000000",
  addressCooldownSec: 86_400,
};

async function loadFaucetStatus(): Promise<FaucetStatusData> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) {
    return DEFAULT_STATUS;
  }
  try {
    const response = await fetch(new URL("/v1/faucet/status", baseUrl), {
      cache: "no-store",
      signal: AbortSignal.timeout(4_000),
    });
    if (!response.ok) return DEFAULT_STATUS;
    return (await response.json()) as FaucetStatusData;
  } catch {
    return DEFAULT_STATUS;
  }
}

export default async function FaucetPage() {
  const status = await loadFaucetStatus();

  return (
    <div className="page-shell">
      <SiteHeader activeSection="faucet" />
      <main className="faucet-page">
        <div className="faucet-container">
          <div className="faucet-heading">
            <span className="eyebrow">Avalanche Testnet Stablecoin</span>
            <h1>fUSD Faucet</h1>
            <p>
              Claim test fUSD from our pre-funded Avalanche faucet wallet to run
              Facets via the CLI, MCP, or Web Playground.
            </p>
          </div>

          <FaucetForm initialStatus={status} />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
