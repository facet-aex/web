"use client";

import {
  formatAtomicFusd,
  getCategoryLabel,
  getFacetTypeMeta,
  parseFusdToAtomic,
  truncateMiddle,
} from "@/lib/facet-ui";
import type { PricingOptionDraft } from "@/lib/pricing-types";

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
  pricingOptions,
  payoutWallet,
  inputFields = [],
  runtimeLabel,
  codeLineCount,
  hasEntrypointExport,
  previewPassed,
  conflictMessage,
  apiMethod,
  apiEndpointLabel,
  liveReadinessStatus,
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
  pricingOptions?: PricingOptionDraft[] | undefined;
  payoutWallet?: string | null | undefined;
  inputFields?: string[] | undefined;
  runtimeLabel?: string | undefined;
  codeLineCount?: number | undefined;
  hasEntrypointExport?: boolean | undefined;
  previewPassed?: boolean | undefined;
  conflictMessage?: string | null | undefined;
  apiMethod?: string | undefined;
  apiEndpointLabel?: string | undefined;
  liveReadinessStatus?: string | undefined;
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
            {pricingOptions && pricingOptions.length > 0 ? (
              <div className="studio-preview-pricing-list">
                {pricingOptions.map((option) => {
                  const atomic = parseFusdToAtomic(option.priceFusd);
                  const optionUnit =
                    option.model === "PAY_PER_RESULT" ? "item" : "run";
                  const capSuffix =
                    option.model === "PAY_PER_RESULT" &&
                    option.maxItemsCap !== undefined
                      ? ` · max ${option.maxItemsCap} items`
                      : "";
                  return (
                    <div key={option.model}>
                      {option.model}
                      {option.isPrimary ? " (Primary)" : ""} ·{" "}
                      {atomic
                        ? `${formatAtomicFusd(atomic)} / ${optionUnit}`
                        : "Invalid price"}
                      {capSuffix}
                    </div>
                  );
                })}
              </div>
            ) : (
              <>
                {pricingModel} ·{" "}
                {priceAtomic
                  ? `${formatAtomicFusd(priceAtomic)} / ${unit}`
                  : "Invalid price"}
              </>
            )}
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
        {facetType === "ACTOR" || facetType === "API" ? (
          <div>
            <dt>Payout Wallet</dt>
            <dd>
              {payoutWallet
                ? `${truncateMiddle(payoutWallet)} ✓`
                : "Not linked yet"}
            </dd>
          </div>
        ) : null}
        {apiMethod ? (
          <div>
            <dt>HTTP Method</dt>
            <dd>{apiMethod}</dd>
          </div>
        ) : null}
        {apiEndpointLabel ? (
          <div>
            <dt>Endpoint</dt>
            <dd>{apiEndpointLabel}</dd>
          </div>
        ) : null}
        {liveReadinessStatus ? (
          <div>
            <dt>Live Readiness</dt>
            <dd>{liveReadinessStatus}</dd>
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
