"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { AgentIdentityCard } from "@/components/agent-identity-card";
import { InputSchemaBuilder } from "@/components/input-schema-builder";
import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import {
  AGENT_TEMPLATE_PRESET,
  CUSTOM_AGENT_PRESET,
  type AgentTemplatePreset,
} from "@/lib/actor-templates";
import {
  ERC8004_IDENTITY_REGISTRY,
  STORE_CATEGORY_FILTERS,
  formatAtomicFusd,
  isValidEvmAddress,
  isValidTxHash,
  snowtraceAddressUrl,
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import {
  FACET_NAME_PATTERN,
  SEMVER_PATTERN,
  suggestFacetName,
} from "@/lib/identifiers";
import {
  parseInputSchemaText,
  schemaToVisualFields,
} from "@/lib/input-schema-builder";
import { readErrorEnvelope } from "@/lib/openapi-import";
import { useAccountWorkspace } from "@/lib/use-account-workspace";

const AGENT_PRESETS: AgentTemplatePreset[] = [
  AGENT_TEMPLATE_PRESET,
  CUSTOM_AGENT_PRESET,
];

export function AgentStudio({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  const workspace = useAccountWorkspace();
  const initialPreset = AGENT_TEMPLATE_PRESET;

  const [activePresetId, setActivePresetId] = useState(initialPreset.id);
  const [facetDisplayName, setFacetDisplayName] = useState(
    initialPreset.facetDisplayName,
  );
  const [facetName, setFacetName] = useState(initialPreset.facetName);
  const [facetNameLocked, setFacetNameLocked] = useState(true);
  const [version, setVersion] = useState("1.0.0");
  const [summary, setSummary] = useState(initialPreset.summary);
  const [category, setCategory] = useState(initialPreset.category);
  const [tagsText, setTagsText] = useState(initialPreset.tags.join(", "));
  const [description, setDescription] = useState(initialPreset.description);

  const [erc8004TokenId, setErc8004TokenId] = useState(
    initialPreset.erc8004TokenId,
  );
  const [taskKind, setTaskKind] = useState(initialPreset.taskKind);
  const [pricingModel, setPricingModel] = useState<
    "PAY_PER_RUN" | "PAY_PER_RESULT"
  >(initialPreset.pricingModel);
  const [priceAtomic, setPriceAtomic] = useState(initialPreset.priceAtomic);
  const [payTo, setPayTo] = useState("");
  const [inputSchemaText, setInputSchemaText] = useState(
    JSON.stringify(initialPreset.inputSchema, null, 2),
  );

  const [showAdvanced, setShowAdvanced] = useState(false);
  const [registryTxHash, setRegistryTxHash] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<{
    provider: string;
    facetName: string;
    facetDisplayName: string;
    version: string;
    erc8004TokenId: string;
    erc8004Registry: string;
    registryVerified: boolean;
  } | null>(null);

  const [verifyTxInput, setVerifyTxInput] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifiedTxHash, setVerifiedTxHash] = useState<string | null>(null);

  function applyPreset(preset: AgentTemplatePreset) {
    setActivePresetId(preset.id);
    setFacetDisplayName(preset.facetDisplayName);
    setFacetName(preset.facetName);
    setFacetNameLocked(true);
    setVersion("1.0.0");
    setSummary(preset.summary);
    setCategory(preset.category);
    setTagsText(preset.tags.join(", "));
    setDescription(preset.description);
    setErc8004TokenId(preset.erc8004TokenId);
    setTaskKind(preset.taskKind);
    setPricingModel(preset.pricingModel);
    setPriceAtomic(preset.priceAtomic);
    setInputSchemaText(JSON.stringify(preset.inputSchema, null, 2));
    setError(null);
    setPublished(null);
    setVerifiedTxHash(null);
    setVerifyError(null);
  }

  const parsedSchema = parseInputSchemaText(inputSchemaText);
  const extractedFields = parsedSchema.schema
    ? schemaToVisualFields(parsedSchema.schema)
    : { editable: false, fields: [] };
  const inputFieldNames =
    extractedFields.fields.length > 0
      ? extractedFields.fields.map((f) => f.name)
      : parsedSchema.schema &&
          typeof parsedSchema.schema.properties === "object" &&
          parsedSchema.schema.properties !== null
        ? Object.keys(parsedSchema.schema.properties)
        : [];

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPublished(null);
    setVerifiedTxHash(null);
    setVerifyError(null);

    if (!/^[1-9][0-9]*$/u.test(erc8004TokenId.trim())) {
      setError(
        "Agent Identity Token ID must be a positive nonzero integer (e.g. 1).",
      );
      return;
    }
    if (!parsedSchema.schema) {
      setError(parsedSchema.error ?? "Input schema must be valid JSON.");
      return;
    }
    if (payTo.trim() && !isValidEvmAddress(payTo)) {
      setError("Agent payout wallet payTo must be a valid 0x EVM address.");
      return;
    }
    if (registryTxHash.trim() && !isValidTxHash(registryTxHash)) {
      setError("Registry transaction hash must be a 0x 64-hex string.");
      return;
    }

    const tags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);

    setSubmitting(true);
    try {
      const response = await fetch("/api/facet/agent-facets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          facetName: facetName.trim(),
          facetDisplayName: facetDisplayName.trim(),
          version: version.trim() || "1.0.0",
          ...(summary.trim() ? { summary: summary.trim() } : {}),
          description: description.trim(),
          category: category.trim(),
          ...(tags.length ? { tags } : {}),
          erc8004TokenId: erc8004TokenId.trim(),
          erc8004Registry: ERC8004_IDENTITY_REGISTRY,
          taskKind: taskKind.trim(),
          inputSchema: parsedSchema.schema,
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
          provider: string;
          facetName: string;
          facetDisplayName?: string;
          version: string;
          erc8004TokenId?: string;
          erc8004Registry?: string;
          registryVerified?: boolean;
        };
        error?: { message?: string };
      } | null;

      if (!response.ok || !body?.facet) {
        throw new Error(
          body?.error?.message ??
            readErrorEnvelope(body) ??
            "Failed to publish Agent.",
        );
      }

      setPublished({
        provider: body.facet.provider,
        facetName: body.facet.facetName,
        facetDisplayName:
          body.facet.facetDisplayName ?? facetDisplayName.trim(),
        version: body.facet.version,
        erc8004TokenId: body.facet.erc8004TokenId ?? erc8004TokenId.trim(),
        erc8004Registry:
          body.facet.erc8004Registry ?? ERC8004_IDENTITY_REGISTRY,
        registryVerified: Boolean(body.facet.registryVerified),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish Agent.");
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
        `/api/facet/facets/${encodeURIComponent(published.provider)}/${encodeURIComponent(published.facetName)}/versions/${encodeURIComponent(published.version)}/verify-registry`,
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
    <div className="agent-studio">
      <header className="studio-mode-header">
        <div>
          <div className="modality-pill-row">
            <span className="badge-type badge-modality-agent">
              ◈ FACET · AGENT
            </span>
            <span className="studio-mode-tag">
              On-Chain Identity Card · Avalanche Fuji
            </span>
          </div>
          <h1>Agent Studio</h1>
          <p>
            Bind an on-chain Agent identity on Avalanche Fuji, define the task
            contract, preview the Agent Card, and publish it as a Facet.
          </p>
        </div>
        <div className="preset-bar" aria-label="Agent starter templates">
          <span>Agent Presets:</span>
          {AGENT_PRESETS.map((preset) => (
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
          <fieldset className="studio-section-box">
            <legend>01 · On-Chain Agent Identity (Avalanche Fuji)</legend>
            <div className="studio-grid">
              <div className="form-field">
                <label htmlFor="agent-identity-id">
                  Agent Identity Token ID (Fuji)
                </label>
                <input
                  id="agent-identity-id"
                  value={erc8004TokenId}
                  onChange={(e) => setErc8004TokenId(e.target.value)}
                  pattern="^[1-9][0-9]*$"
                  required
                />
                <small>
                  Positive nonzero token ID minted on the Fuji Agent Identity
                  Registry.
                </small>
              </div>
              <div className="form-field">
                <label htmlFor="agent-identity-registry">
                  Agent Identity Registry (Fuji 43113)
                </label>
                <input
                  id="agent-identity-registry"
                  value={ERC8004_IDENTITY_REGISTRY}
                  readOnly
                />
                <small>
                  <a
                    className="explorer-link"
                    href={snowtraceAddressUrl(ERC8004_IDENTITY_REGISTRY)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Inspect contract on Snowtrace ↗
                  </a>
                </small>
              </div>
              <div className="form-field">
                <label htmlFor="agent-task-kind">Task Kind</label>
                <input
                  id="agent-task-kind"
                  value={taskKind}
                  onChange={(e) => setTaskKind(e.target.value)}
                  maxLength={80}
                  required
                />
                <small>
                  Use <code>vn-market-analysis</code> for live execution on the
                  built-in Fuji runner.
                </small>
              </div>
              <div className="form-field">
                <label htmlFor="agent-payto">
                  Agent Payout Wallet payTo (optional)
                </label>
                <input
                  id="agent-payto"
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
                  ? "Hide Pre-Anchor Options"
                  : "Advanced: Pre-Anchored FacetActorRegistry Tx"}
              </button>
              {showAdvanced ? (
                <div className="studio-grid advanced-fields">
                  <div className="form-field">
                    <label htmlFor="agent-registry-tx">
                      Pre-Anchored Registry Tx Hash (optional)
                    </label>
                    <input
                      id="agent-registry-tx"
                      value={registryTxHash}
                      onChange={(e) => setRegistryTxHash(e.target.value)}
                      placeholder="0x..."
                    />
                  </div>
                </div>
              ) : null}
            </div>
          </fieldset>

          <fieldset className="studio-section-box">
            <legend>02 · Agent Profile &amp; x402 Pricing</legend>
            <div className="studio-grid">
              <div className="form-field">
                <label htmlFor="agent-display-name">Agent Display Name</label>
                <input
                  id="agent-display-name"
                  value={facetDisplayName}
                  onChange={(e) => {
                    const nextName = e.target.value;
                    setFacetDisplayName(nextName);
                    if (!facetNameLocked) {
                      setFacetName(suggestFacetName(nextName));
                    }
                  }}
                  maxLength={120}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="agent-facet-name">
                  Facet Name (kebab-case, 4–32 chars)
                </label>
                <input
                  id="agent-facet-name"
                  value={facetName}
                  onChange={(e) => {
                    setFacetNameLocked(true);
                    setFacetName(e.target.value);
                  }}
                  pattern={FACET_NAME_PATTERN}
                  minLength={4}
                  maxLength={32}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="agent-version">Version (SemVer)</label>
                <input
                  id="agent-version"
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  pattern={SEMVER_PATTERN}
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="agent-category">Category</label>
                <input
                  id="agent-category"
                  list="agent-category-presets"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={80}
                  required
                />
                <datalist id="agent-category-presets">
                  {STORE_CATEGORY_FILTERS.AGENT.filter(
                    (option) => option.slug,
                  ).map((option) => (
                    <option key={option.slug} value={option.slug}>
                      {option.label}
                    </option>
                  ))}
                </datalist>
              </div>
              <div className="form-field">
                <label htmlFor="agent-tags">Tags (comma-separated)</label>
                <input
                  id="agent-tags"
                  value={tagsText}
                  onChange={(e) => setTagsText(e.target.value)}
                  placeholder="vietnam, agent, analytics"
                />
              </div>
              <div className="form-field">
                <label htmlFor="agent-pricing-model">x402 Settlement</label>
                <select
                  id="agent-pricing-model"
                  value={pricingModel}
                  onChange={(e) =>
                    setPricingModel(
                      e.target.value as "PAY_PER_RUN" | "PAY_PER_RESULT",
                    )
                  }
                >
                  <option value="PAY_PER_RUN">
                    PAY_PER_RUN (Instant FeeSplit)
                  </option>
                  <option value="PAY_PER_RESULT">
                    PAY_PER_RESULT (TaskEscrow per citation)
                  </option>
                </select>
              </div>
              <div className="form-field">
                <label htmlFor="agent-price">
                  Price (atomic fUSD · {formatAtomicFusd(priceAtomic)})
                </label>
                <input
                  id="agent-price"
                  value={priceAtomic}
                  onChange={(e) => setPriceAtomic(e.target.value)}
                  pattern="^[1-9][0-9]*$"
                  required
                />
              </div>
            </div>

            <div className="form-field">
              <label htmlFor="agent-summary">Agent Card Headline</label>
              <input
                id="agent-summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                maxLength={280}
                placeholder="One-line mission displayed on the Agent Card"
              />
            </div>

            <div className="form-field">
              <label htmlFor="agent-description">
                Capabilities &amp; Delegation Scope
              </label>
              <input
                id="agent-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={10000}
                required
              />
            </div>
          </fieldset>

          <fieldset className="studio-section-box">
            <legend>03 · A2A Task Input Schema</legend>
            <InputSchemaBuilder
              value={inputSchemaText}
              onChange={setInputSchemaText}
              disabled={submitting}
              idPrefix="agent-schema"
            />
          </fieldset>

          {error ? (
            <div className="error-banner" role="alert">
              <strong>Registration error</strong>
              <p>{error}</p>
            </div>
          ) : null}

          <button
            type="submit"
            className="button button-primary"
            disabled={
              submitting || workspace.authRequired || workspace.usernameRequired
            }
          >
            {submitting ? "Publishing Agent…" : "Publish Agent"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>

        <aside
          className="studio-inspector-pane"
          aria-label="Live On-Chain Agent Card preview"
        >
          <AgentIdentityCard
            {...(workspace.username ? { provider: workspace.username } : {})}
            facetDisplayName={facetDisplayName}
            facetName={facetName}
            version={version}
            summary={summary || description}
            erc8004Registry={ERC8004_IDENTITY_REGISTRY}
            erc8004TokenId={erc8004TokenId}
            taskKind={taskKind}
            pricingModel={pricingModel}
            priceAtomic={priceAtomic}
            {...(payTo.trim() ? { payTo: payTo.trim() } : {})}
            registryVerified={Boolean(published?.registryVerified)}
            {...(verifiedTxHash || registryTxHash.trim()
              ? { registryTxHash: verifiedTxHash ?? registryTxHash.trim() }
              : {})}
            inputFields={inputFieldNames}
          />

          {published ? (
            <div className="published-card" role="status">
              <p className="eyebrow">Agent Published</p>
              <strong>
                {published.provider}/{published.facetName}@{published.version} ·
                Identity #{published.erc8004TokenId}
              </strong>
              <Link
                className="button button-primary import-submit"
                href={`/facets/${encodeURIComponent(published.provider)}/${encodeURIComponent(published.facetName)}`}
              >
                Open Playground <span aria-hidden="true">↗</span>
              </Link>

              <div className="verify-tx-box">
                <label htmlFor="agent-verify-tx">
                  Verify Fuji FacetActorRegistry Tx (optional)
                </label>
                <div className="verify-tx-row">
                  <input
                    id="agent-verify-tx"
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
