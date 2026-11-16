import Link from "next/link";
import { notFound } from "next/navigation";
import { FacetPlayground } from "@/components/facet-playground";
import { getPublicFacet } from "@/lib/public-catalog";

export default async function FacetDetailPage({
  params,
}: {
  params: Promise<{ facetId: string }>;
}) {
  const { facetId } = await params;
  if (!/^[0-9a-f-]{36}$/iu.test(facetId)) notFound();
  const facet = await getPublicFacet(facetId);
  if (!facet) notFound();

  const priceFusd = facet.pricing
    ? `${Number(facet.pricing.priceAtomic) / 1_000_000} fUSD (${facet.pricing.model})`
    : "0.001 fUSD (PAY_PER_RUN)";

  return (
    <main className="store facet-detail-page">
      <Link className="back-link" href="/">
        ← Facet Store
      </Link>
      <div className="detail-header">
        <div>
          <p className="eyebrow">
            {facet.facetType ?? "EXTERNAL_HTTP_API"} / {facet.provider.name} /{" "}
            {facet.category}
          </p>
          <h1>{facet.name}</h1>
          <p className="detail-description">{facet.description}</p>
        </div>
      </div>

      <dl className="detail-meta-grid">
        <div>
          <dt>Version</dt>
          <dd>v{facet.displayVersion}</dd>
        </div>
        <div>
          <dt>Method</dt>
          <dd>{facet.method}</dd>
        </div>
        <div>
          <dt>x402 Pricing (Fuji)</dt>
          <dd>{priceFusd}</dd>
        </div>
        <div>
          <dt>Facet ID</dt>
          <dd>{facet.id}</dd>
        </div>
        {facet.actorMeta ? (
          <>
            <div>
              <dt>Docker Runtime</dt>
              <dd>{facet.actorMeta.runtime}</dd>
            </div>
            <div>
              <dt>On-Chain Image Digest</dt>
              <dd>{facet.actorMeta.imageDigest}</dd>
            </div>
          </>
        ) : null}
        {facet.agentMeta ? (
          <>
            <div>
              <dt>ERC-8004 Identity Token</dt>
              <dd>#{facet.agentMeta.erc8004TokenId}</dd>
            </div>
            <div>
              <dt>ERC-8004 Registry (Fuji)</dt>
              <dd>
                <a
                  className="explorer-link"
                  href={`https://testnet.snowtrace.io/address/${facet.agentMeta.erc8004Registry}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  {facet.agentMeta.erc8004Registry} ↗
                </a>
              </dd>
            </div>
            <div>
              <dt>A2A Task Kind</dt>
              <dd>{facet.agentMeta.taskKind}</dd>
            </div>
          </>
        ) : null}
        {(facet.actorMeta?.registryTxHash ??
        facet.agentMeta?.registryTxHash) ? (
          <div>
            <dt>ActorRegistry Tx</dt>
            <dd>
              <a
                className="explorer-link"
                href={`https://testnet.snowtrace.io/tx/${facet.actorMeta?.registryTxHash ?? facet.agentMeta?.registryTxHash}`}
                target="_blank"
                rel="noreferrer"
              >
                {facet.actorMeta?.registryTxHash ??
                  facet.agentMeta?.registryTxHash}{" "}
                ↗
              </a>
            </dd>
          </div>
        ) : null}
      </dl>

      <FacetPlayground facet={facet} />

      <div className="schema-pair">
        <div>
          <h2>Input schema</h2>
          <pre className="json-pre">
            {JSON.stringify(facet.inputSchema, null, 2)}
          </pre>
        </div>
        <div>
          <h2>Output schema</h2>
          <pre className="json-pre">
            {JSON.stringify(facet.outputSchema, null, 2)}
          </pre>
        </div>
      </div>
    </main>
  );
}
