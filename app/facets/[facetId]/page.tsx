import Link from "next/link";
import { notFound } from "next/navigation";
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
  return (
    <main className="store">
      <Link href="/">← Facet Store</Link>
      <p className="eyebrow">
        {facet.provider.name} / {facet.category}
      </p>
      <h1>{facet.name}</h1>
      <p>{facet.description}</p>
      <dl>
        <dt>Version</dt>
        <dd>{facet.displayVersion}</dd>
        <dt>Method</dt>
        <dd>{facet.method}</dd>
        <dt>Facet ID</dt>
        <dd>{facet.id}</dd>
      </dl>
      <h2>Input schema</h2>
      <pre>{JSON.stringify(facet.inputSchema, null, 2)}</pre>
      <h2>Output schema</h2>
      <pre>{JSON.stringify(facet.outputSchema, null, 2)}</pre>
    </main>
  );
}
