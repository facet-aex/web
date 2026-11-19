"use client";

import {
  formatAtomicFusd,
  getCategoryLabel,
  getFacetTypeMeta,
  truncateMiddle,
} from "@/lib/facet-ui";

export function StudioFacetPreviewCard({
  facetType,
  provider,
  facetDisplayName,
  facetName,
  version,
  category,
  summary,
  description,
  tags,
  pricingModel,
  priceAtomic,
  payoutWallet,
  inputFields,
  runtimeLabel,
  codeLineCount,
  hasEntrypointExport,
  previewPassed,
  conflictMessage,
}: {
  facetType: "ACTOR" | "API";
  provider?: string | undefined;
  facetDisplayName: string;
  facetName: string;
  version: string;
  category: string;
  summary: string;
  description: string;
  tags: string[];
  pricingModel: "PAY_PER_RUN" | "PAY_PER_RESULT";
  priceAtomic: string | null;
  payoutWallet?: string | null | undefined;
  inputFields: string[];
  runtimeLabel?: string | undefined;
  codeLineCount?: number | undefined;
  hasEntrypointExport?: boolean | undefined;
  previewPassed?: boolean | undefined;
  conflictMessage?: string | null | undefined;
}) {
  const meta = getFacetTypeMeta(facetType);
  const unit = pricingModel === "PAY_PER_RESULT" ? "item" : "run";

  const statusTone = conflictMessage
    ? "conflict"
    : previewPassed
      ? "verified"
      : "draft";
  const statusLabel = conflictMessage
    ? "Conflict"
    : previewPassed
      ? "Preview Passed ✓"
      : "Live Draft";

  const headline = facetDisplayName.trim() || "Untitled Facet";
  const handle = `${provider ?? "your-account"}/${facetName.trim() || "facet-name"}@${version.trim() || "1.0.0"}`;
  const blurb =
    summary.trim() ||
    description.trim() ||
    "Add a short summary or description to preview how buyers discover this Facet.";

  return (
    <section
      className="inspector-card studio-preview-card"
      aria-label="Facet Preview"
    >
      <div className="studio-preview-top">
        <span className="eyebrow">Facet Preview</span>
        <span
          className={`studio-preview-pill studio-preview-pill-${statusTone}`}
        >
          {statusLabel}
        </span>
      </div>

      <div className="modality-pill-row">
        <span className={`badge-type badge-${meta.accentClass}`}>
          {meta.glyph} {meta.facetTag}
        </span>
        <span className="kicker-chip">
          {getCategoryLabel(category, facetType)}
        </span>
      </div>

      <div className="studio-preview-identity">
        <h3>{headline}</h3>
        <p className="mono-detail">{handle}</p>
      </div>

      <p className="studio-preview-blurb">{blurb}</p>

      {tags.length > 0 ? (
        <div className="studio-preview-tags">
          {tags.slice(0, 6).map((tag) => (
            <span key={tag} className="kicker-chip">
              #{tag}
            </span>
          ))}
        </div>
      ) : null}

      <dl className="inspector-specs">
        <div>
          <dt>Pricing</dt>
          <dd>
            {pricingModel} ·{" "}
            {priceAtomic
              ? `${formatAtomicFusd(priceAtomic)} / ${unit}`
              : "Invalid price"}
          </dd>
        </div>
        <div>
          <dt>Input Schema</dt>
          <dd>
            {inputFields.length > 0 ? (
              <div className="studio-preview-fields">
                {inputFields.map((field) => (
                  <code key={field}>{field}</code>
                ))}
              </div>
            ) : (
              "No fields defined"
            )}
          </dd>
        </div>
        {facetType === "ACTOR" ? (
          <div>
            <dt>Payout Wallet</dt>
            <dd>
              {payoutWallet
                ? `${truncateMiddle(payoutWallet)} ✓`
                : "Not linked yet"}
            </dd>
          </div>
        ) : null}
        {runtimeLabel ? (
          <div>
            <dt>Runtime / Code</dt>
            <dd>
              {runtimeLabel}
              {codeLineCount !== undefined ? ` · ${codeLineCount} lines` : ""}
              {hasEntrypointExport === false ? " (export missing)" : ""}
            </dd>
          </div>
        ) : null}
      </dl>
    </section>
  );
}
