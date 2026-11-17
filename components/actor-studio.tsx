"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { InputSchemaBuilder } from "@/components/input-schema-builder";
import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import {
  ACTOR_TEMPLATE_PRESETS,
  BLANK_ACTOR_PRESET,
  type ActorTemplatePreset,
} from "@/lib/actor-templates";
import {
  STORE_CATEGORY_FILTERS,
  formatAtomicFusd,
  isValidEvmAddress,
  isValidTxHash,
  slugifyName,
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import {
  parseInputSchemaText,
  schemaToVisualFields,
} from "@/lib/input-schema-builder";
import { readErrorEnvelope } from "@/lib/openapi-import";
import { useProviderWorkspace } from "@/lib/use-provider-workspace";

type ActorEditorTab = "source" | "schema" | "pricing";

const ALL_ACTOR_PRESETS: ActorTemplatePreset[] = [
  BLANK_ACTOR_PRESET,
  ...ACTOR_TEMPLATE_PRESETS,
];

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export function ActorStudio({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  const workspace = useProviderWorkspace();
  const initialPreset = ACTOR_TEMPLATE_PRESETS[0]!;

  const [activePresetId, setActivePresetId] = useState(initialPreset.id);
  const [editorTab, setEditorTab] = useState<ActorEditorTab>("source");

  const [name, setName] = useState(initialPreset.name);
  const [slug, setSlug] = useState(initialPreset.slug);
  const [slugLocked, setSlugLocked] = useState(true);
  const [summary, setSummary] = useState(initialPreset.summary);
  const [category, setCategory] = useState(initialPreset.category);
  const [tagsText, setTagsText] = useState(initialPreset.tags.join(", "));
  const [description, setDescription] = useState(initialPreset.description);
  const [pricingModel, setPricingModel] = useState<
    "PAY_PER_RUN" | "PAY_PER_RESULT"
  >(initialPreset.pricingModel);
  const [priceAtomic, setPriceAtomic] = useState(initialPreset.priceAtomic);
  const [payTo, setPayTo] = useState("");
  const [inputSchemaText, setInputSchemaText] = useState(
    JSON.stringify(initialPreset.inputSchema, null, 2),
  );
  const [code, setCode] = useState(initialPreset.code);

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [explicitFacetId, setExplicitFacetId] = useState("");
  const [registryTxHash, setRegistryTxHash] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<{
    id: string;
    slug: string;
    imageDigest: string;
    registryVerified: boolean;
  } | null>(null);

  const [verifyTxInput, setVerifyTxInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedTxHash, setVerifiedTxHash] = useState<string | null>(null);

  function applyPreset(preset: ActorTemplatePreset) {
    setActivePresetId(preset.id);
    setName(preset.name);
    setSlug(preset.slug);
    setSlugLocked(true);
    setSummary(preset.summary);
    setCategory(preset.category);
    setTagsText(preset.tags.join(", "));
    setDescription(preset.description);
    setPricingModel(preset.pricingModel);
    setPriceAtomic(preset.priceAtomic);
    setInputSchemaText(JSON.stringify(preset.inputSchema, null, 2));
    setCode(preset.code);
    setError(null);
    setPublished(null);
    setVerifiedTxHash(null);
    setVerifyError(null);
  }

  const parsedSchema = parseInputSchemaText(inputSchemaText);
  const extractedFields = parsedSchema.schema
    ? schemaToVisualFields(parsedSchema.schema)
    : { editable: false, fields: [] };
  const hasEntrypointExport =
    /(export\s+default\b|export\s+(?:async\s+)?function\s+run\b)/u.test(
      code.trim(),
    );
  const codeLineCount = Math.max(code.split("\n").length, 1);

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPublished(null);
    setVerifiedTxHash(null);
    setVerifyError(null);

    if (!parsedSchema.schema) {
      setError(parsedSchema.error ?? "Input schema must be valid JSON.");
      return;
    }
    if (!hasEntrypointExport) {
      setError(
        "Actor JavaScript code must export a default function or named `run(input)` function.",
      );
      return;
    }
    if (payTo.trim() && !isValidEvmAddress(payTo)) {
      setError("Creator wallet payTo must be a valid 0x EVM address.");
      return;
    }
    if (registryTxHash.trim()) {
      if (!isValidTxHash(registryTxHash)) {
        setError("Registry transaction hash must be a 0x 64-hex string.");
        return;
      }
      if (!UUID_PATTERN.test(explicitFacetId.trim())) {
        setError(
          "Supplying a pre-anchored registryTxHash requires a matching explicit Facet UUID.",
        );
        return;
      }
    }

    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);

    setSubmitting(true);
    try {
      const ensured = await workspace.ensureProvider(payTo);
      if (!ensured.providerId) {
        throw new Error(
          ensured.authRequired
            ? "Sign in with Clerk to publish capabilities under your account."
            : (ensured.error ??
                "Your provider workspace could not be initialized."),
        );
      }

      const response = await fetch("/api/facet/actors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          ...(explicitFacetId.trim() ? { id: explicitFacetId.trim() } : {}),
          providerId: ensured.providerId,
          name: name.trim(),
          slug: slug.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
          description: description.trim(),
          category: category.trim(),
          ...(tags.length ? { tags } : {}),
          inputSchema: parsedSchema.schema,
          code,
          pricingModel,
          priceAtomic: priceAtomic.trim() || "1000",
          ...(payTo.trim() ? { payTo: payTo.trim() } : {}),
          ...(registryTxHash.trim()
            ? { registryTxHash: registryTxHash.trim() }
            : {}),
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        facet?: {
          id: string;
          slug: string;
          imageDigest?: string;
          registryVerified?: boolean;
        };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.facet) {
        throw new Error(
          body?.error?.message ??
            readErrorEnvelope(body) ??
            "Failed to publish Actor.",
        );
      }

      setPublished({
        id: body.facet.id,
        slug: body.facet.slug,
        imageDigest: body.facet.imageDigest ?? "sha256:computed",
        registryVerified: Boolean(body.facet.registryVerified),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish Actor.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerifyRegistry() {
    if (!published) return;
    setVerifyError(null);
    if (!isValidTxHash(verifyTxInput)) {
      setVerifyError("Enter a valid 0x 64-hex Fuji transaction hash.");
      return;
    }
    setVerifying(true);
    try {
      const response = await fetch(
        `/api/facet/facets/${encodeURIComponent(published.id)}/verify-registry`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ registryTxHash: verifyTxInput.trim() }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        registryVerified?: boolean;
        registryTxHash?: string;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.registryVerified) {
        throw new Error(
          body?.error?.message ??
            "Fuji FacetActorRegistry verification failed.",
        );
      }
      setVerifiedTxHash(body.registryTxHash ?? verifyTxInput.trim());
      setPublished((prev) =>
        prev ? { ...prev, registryVerified: true } : prev,
      );
    } catch (err) {
      setVerifyError(
        err instanceof Error ? err.message : "Verification failed.",
      );
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="actor-studio">
      <header className="studio-mode-header">
        <div>
          <div className="modality-pill-row">
            <span className="badge-type badge-modality-actor">
              ▣ FACET · ACTOR
            </span>
            <span className="studio-mode-tag">
              Isolated Container Runner · Docker Sandbox
            </span>
          </div>
          <h1>Actor Studio</h1>
          <p>
            Write an ESM Node.js module, define your input form visually, and
            publish it as a Facet executed inside an isolated container with
            x402 settlement.
          </p>
        </div>
        <div className="preset-bar" aria-label="Actor starter templates">
          <span>Starter Templates:</span>
          {ALL_ACTOR_PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              className={`preset-chip ${activePresetId === preset.id ? "preset-chip-active" : ""}`}
              onClick={() => applyPreset(preset)}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </header>

      <ProviderSelectorBar
        workspace={workspace}
        publishableKey={publishableKey}
      />

      <form className="studio-workbench-grid" onSubmit={handlePublish}>
        <div className="studio-editor-pane">
          <div className="studio-identity-bar">
            <div className="form-field">
              <label htmlFor="actor-name">Actor Name</label>
              <input
                id="actor-name"
                value={name}
                onChange={(e) => {
                  const nextName = e.target.value;
                  setName(nextName);
                  if (!slugLocked) setSlug(slugifyName(nextName));
                }}
                maxLength={120}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="actor-slug">Slug</label>
              <input
                id="actor-slug"
                value={slug}
                onChange={(e) => {
                  setSlugLocked(true);
                  setSlug(e.target.value);
                }}
                pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="form-field">
              <label htmlFor="actor-category">Category</label>
              <input
                id="actor-category"
                list="actor-category-presets"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={80}
                required
              />
              <datalist id="actor-category-presets">
                {STORE_CATEGORY_FILTERS.HOSTED_ACTOR.filter(
                  (option) => option.slug,
                ).map((option) => (
                  <option key={option.slug} value={option.slug}>
                    {option.label}
                  </option>
                ))}
              </datalist>
            </div>
          </div>

          <div
            className="studio-tabs studio-workspace-tabs"
            role="tablist"
            aria-label="Actor workspace sections"
          >
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "source"}
              className={`tab-button ${editorTab === "source" ? "tab-active" : ""}`}
              onClick={() => setEditorTab("source")}
            >
              01 · Source &amp; Metadata
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "schema"}
              className={`tab-button ${editorTab === "schema" ? "tab-active" : ""}`}
              onClick={() => setEditorTab("schema")}
            >
              02 · Input Schema ({extractedFields.fields.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={editorTab === "pricing"}
              className={`tab-button ${editorTab === "pricing" ? "tab-active" : ""}`}
              onClick={() => setEditorTab("pricing")}
            >
              03 · Pricing &amp; Payout
            </button>
          </div>

          {editorTab === "source" ? (
            <div className="studio-tab-panel">
              <div className="studio-grid">
                <div className="form-field">
                  <label htmlFor="actor-summary">Short Summary</label>
                  <input
                    id="actor-summary"
                    value={summary}
                    onChange={(e) => setSummary(e.target.value)}
                    maxLength={280}
                    placeholder="One-line summary for Store and MCP search"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="actor-tags">Tags (comma-separated)</label>
                  <input
                    id="actor-tags"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="vietnam, gold, fx, dataset"
                  />
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="actor-description">Full Description</label>
                <input
                  id="actor-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={10000}
                  required
                />
              </div>

              <div className="code-editor-shell">
                <div className="code-editor-toolbar">
                  <span>main.mjs · ESM Entrypoint</span>
                  <span
                    className={
                      hasEntrypointExport ? "code-ok-badge" : "code-warn-badge"
                    }
                  >
                    {hasEntrypointExport
                      ? "export default / run(input) detected ✓"
                      : "Must export default or named run(input)"}
                  </span>
                </div>
                <div className="code-editor-frame">
                  <div className="code-gutter" aria-hidden="true">
                    {Array.from({ length: codeLineCount }, (_, idx) => (
                      <span key={idx + 1}>{idx + 1}</span>
                    ))}
                  </div>
                  <textarea
                    id="actor-code"
                    aria-label="Actor JavaScript Code (main.mjs)"
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    rows={Math.max(codeLineCount, 12)}
                    spellCheck={false}
                    required
                  />
                </div>
                <small className="code-editor-hint">
                  Return an Array of objects to populate the Store Dataset Table
                  Viewer automatically, or return a single Object.
                </small>
              </div>
            </div>
          ) : null}

          {editorTab === "schema" ? (
            <div className="studio-tab-panel">
              <p className="panel-intro">
                Define the Actor&apos;s JSON Schema 2020-12 input contract. The
                Store automatically generates an interactive form from this
                schema, and the Gateway validates every paid request against it.
              </p>
              <InputSchemaBuilder
                value={inputSchemaText}
                onChange={setInputSchemaText}
                disabled={submitting}
                idPrefix="actor-schema"
              />
            </div>
          ) : null}

          {editorTab === "pricing" ? (
            <div className="studio-tab-panel">
              <fieldset className="pricing-mode-cards">
                <legend>x402 Settlement Model (Avalanche Fuji fUSD)</legend>
                <label className="pricing-card">
                  <input
                    type="radio"
                    name="actor-pricing-model"
                    value="PAY_PER_RUN"
                    checked={pricingModel === "PAY_PER_RUN"}
                    onChange={() => setPricingModel("PAY_PER_RUN")}
                  />
                  <span>
                    <strong>PAY_PER_RUN</strong>
                    <small>
                      Instant FeeSplit settlement on completion (95% creator /
                      5% treasury).
                    </small>
                  </span>
                </label>
                <label className="pricing-card">
                  <input
                    type="radio"
                    name="actor-pricing-model"
                    value="PAY_PER_RESULT"
                    checked={pricingModel === "PAY_PER_RESULT"}
                    onChange={() => setPricingModel("PAY_PER_RESULT")}
                  />
                  <span>
                    <strong>PAY_PER_RESULT</strong>
                    <small>
                      TaskEscrow meters exact dataset items returned and refunds
                      unused fUSD automatically.
                    </small>
                  </span>
                </label>
              </fieldset>

              <div className="studio-grid">
                <div className="form-field">
                  <label htmlFor="actor-price">
                    Price in Atomic fUSD (6 decimals ·{" "}
                    {formatAtomicFusd(priceAtomic)})
                  </label>
                  <input
                    id="actor-price"
                    value={priceAtomic}
                    onChange={(e) => setPriceAtomic(e.target.value)}
                    pattern="^[1-9][0-9]*$"
                    required
                  />
                  <small>
                    1000 = 0.001 fUSD. Keep PAY_PER_RESULT ≤ 5000 atomic so
                    20-item escrow fits default demo limits.
                  </small>
                </div>
                <div className="form-field">
                  <label htmlFor="actor-payto">
                    Creator Payout Wallet payTo (optional)
                  </label>
                  <input
                    id="actor-payto"
                    value={payTo}
                    onChange={(e) => setPayTo(e.target.value)}
                    placeholder="0x... (defaults to provider wallet)"
                  />
                </div>
              </div>

              <div className="advanced-toggle-box">
                <button
                  type="button"
                  className="preset-chip"
                  onClick={() => setShowAdvanced((prev) => !prev)}
                  aria-expanded={showAdvanced}
                >
                  {showAdvanced
                    ? "Hide Advanced On-Chain Pre-Anchor"
                    : "Advanced: Pre-Anchored FacetActorRegistry Tx"}
                </button>
                {showAdvanced ? (
                  <div className="studio-grid advanced-fields">
                    <div className="form-field">
                      <label htmlFor="actor-explicit-id">
                        Explicit Facet UUID (optional)
                      </label>
                      <input
                        id="actor-explicit-id"
                        value={explicitFacetId}
                        onChange={(e) => setExplicitFacetId(e.target.value)}
                        placeholder="019a69b8-..."
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor="actor-registry-tx">
                        Pre-Anchored Registry Tx Hash (optional)
                      </label>
                      <input
                        id="actor-registry-tx"
                        value={registryTxHash}
                        onChange={(e) => setRegistryTxHash(e.target.value)}
                        placeholder="0x..."
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        <aside
          className="studio-inspector-pane"
          aria-label="Actor build summary"
        >
          <div className="inspector-card">
            <p className="eyebrow">Sandbox Runtime Spec</p>
            <h3>facet/node-actor-runner:1.0</h3>
            <dl className="inspector-specs">
              <div>
                <dt>Base Image</dt>
                <dd>nodejs22-alpine-v1</dd>
              </div>
              <div>
                <dt>CPU / Memory</dt>
                <dd>0.5 vCPU · 128 MB RAM</dd>
              </div>
              <div>
                <dt>Isolation Flags</dt>
                <dd>--rm --pids-limit=32 --read-only --network=none</dd>
              </div>
              <div>
                <dt>Pricing Quote</dt>
                <dd>
                  {formatAtomicFusd(priceAtomic)} /{" "}
                  {pricingModel === "PAY_PER_RESULT" ? "item" : "run"}
                </dd>
              </div>
            </dl>
          </div>

          <div className="inspector-card">
            <p className="eyebrow">Publish Readiness</p>
            <ul className="readiness-list">
              <li data-ok={!workspace.authRequired}>
                {workspace.authRequired
                  ? "○ Sign in with Clerk required to publish"
                  : workspace.providerId
                    ? "✓ Account provider workspace ready"
                    : "✓ Publishes under signed-in account"}
              </li>
              <li data-ok={hasEntrypointExport}>
                {hasEntrypointExport
                  ? `✓ ESM entrypoint (${codeLineCount} lines)`
                  : "○ Export default or run(input) required"}
              </li>
              <li data-ok={Boolean(parsedSchema.schema)}>
                {parsedSchema.schema
                  ? `✓ Valid JSON Schema (${extractedFields.fields.length} visual fields)`
                  : "○ Fix JSON Schema syntax"}
              </li>
            </ul>

            {error ? (
              <div className="error-banner" role="alert">
                <strong>Publish error</strong>
                <p>{error}</p>
              </div>
            ) : null}

            <button
              type="submit"
              className="button button-primary import-submit"
              disabled={submitting || workspace.authRequired}
            >
              {submitting ? "Publishing Actor…" : "Publish Actor"}
              <span aria-hidden="true">↗</span>
            </button>
          </div>

          {published ? (
            <div className="published-card" role="status">
              <p className="eyebrow">Actor Published</p>
              <strong>{published.slug}</strong>
              <p className="mono-detail">
                imageDigest: {published.imageDigest}
              </p>
              <Link
                className="button button-primary import-submit"
                href={`/facets/${published.id}`}
              >
                Open &amp; Run in Playground <span aria-hidden="true">↗</span>
              </Link>

              <div className="verify-tx-box">
                <label htmlFor="actor-verify-tx">
                  Verify Fuji FacetActorRegistry Tx (optional)
                </label>
                <div className="verify-tx-row">
                  <input
                    id="actor-verify-tx"
                    value={verifyTxInput}
                    onChange={(e) => setVerifyTxInput(e.target.value)}
                    placeholder="0x... Fuji tx hash"
                  />
                  <button
                    type="button"
                    className="button button-secondary"
                    disabled={verifying || !verifyTxInput.trim()}
                    onClick={() => void handleVerifyRegistry()}
                  >
                    {verifying ? "Verifying…" : "Verify"}
                  </button>
                </div>
                {verifyError ? (
                  <small className="field-warning">{verifyError}</small>
                ) : null}
                {verifiedTxHash ? (
                  <p className="mono-accent">
                    Verified on Fuji ✓{" "}
                    <a
                      className="explorer-link"
                      href={snowtraceTxUrl(verifiedTxHash)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      View tx ↗
                    </a>
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
        </aside>
      </form>
    </div>
  );
}
