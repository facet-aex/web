"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { AgentIdentityCard } from "@/components/agent-identity-card";
import { FacetPricingFields } from "@/components/facet-pricing-fields";
import { InputSchemaBuilder } from "@/components/input-schema-builder";
import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import {
  PublishRedirectToast,
  buildMyFacetsRedirectHref,
} from "@/components/publish-redirect-toast";
import {
  StudioStageBar,
  computeStudioProgress,
} from "@/components/studio-stage-bar";
import {
  AGENT_TEMPLATE_PRESET,
  CUSTOM_AGENT_PRESET,
  type AgentTemplatePreset,
} from "@/lib/actor-templates";
import {
  ERC8004_IDENTITY_REGISTRY,
  atomicToFusdInput,
  getCategoryLabel,
  getCategoryOptionsWithCurrent,
  isValidEvmAddress,
  isValidTxHash,
  parseFusdToAtomic,
  snowtraceAddressUrl,
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import {
  FACET_NAME_PATTERN,
  SEMVER_PATTERN,
  bumpSemver,
  isValidFacetName,
  isValidSemver,
  suggestFacetName,
} from "@/lib/identifiers";
import {
  parseInputSchemaText,
  schemaToVisualFields,
} from "@/lib/input-schema-builder";
import { readErrorEnvelope } from "@/lib/openapi-import";
import { useAccountWorkspace } from "@/lib/use-account-workspace";
import {
  checkFacetIdentityConflict,
  useOwnedFacets,
} from "@/lib/use-owned-facets";

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
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [completedUpTo, setCompletedUpTo] = useState(0);
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
  const pricingModel = "PAY_PER_RUN" as const;
  const [priceFusdText, setPriceFusdText] = useState(
    atomicToFusdInput(initialPreset.priceAtomic),
  );
  const priceAtomic = parseFusdToAtomic(priceFusdText);
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

  const ownedFacets = useOwnedFacets(
    workspace.username,
    published ? "published" : undefined,
  );

  function applyPreset(preset: AgentTemplatePreset) {
    setActivePresetId(preset.id);
    setActiveStep(1);
    setCompletedUpTo(0);
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
    setPriceFusdText(atomicToFusdInput(preset.priceAtomic));
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

  const identityConflict = checkFacetIdentityConflict(ownedFacets, {
    facetName,
    version,
    facetType: "AGENT",
  });

  const step1BlockReason = !facetDisplayName.trim()
    ? "Enter an Agent Display Name before continuing."
    : !isValidFacetName(facetName.trim())
      ? "Facet Name must be 4–32 lowercase letters, numbers, or hyphens."
      : !isValidSemver(version.trim())
        ? "Version must follow SemVer (for example, 1.0.0)."
        : identityConflict
          ? identityConflict.message
          : !category.trim()
            ? "Select a Category before continuing."
            : !description.trim()
              ? "Enter Capabilities & Delegation Scope before continuing."
              : !/^[1-9][0-9]*$/u.test(erc8004TokenId.trim())
                ? "Agent Identity Token ID must be a positive nonzero integer."
                : !taskKind.trim()
                  ? "Enter a Task Kind before continuing."
                  : registryTxHash.trim() && !isValidTxHash(registryTxHash)
                    ? "Registry transaction hash must be a 0x 64-hex string."
                    : null;
  const step1Valid = step1BlockReason === null;

  const step2Valid = Boolean(parsedSchema.schema);
  const step2BlockReason = step2Valid
    ? null
    : (parsedSchema.error ?? "Fix JSON Schema syntax before continuing.");

  const step3Valid = step1Valid && step2Valid;
  const step3BlockReason = step3Valid
    ? null
    : (step1BlockReason ?? step2BlockReason);

  const progress = computeStudioProgress({
    activeStep,
    completedUpTo,
    stepValidities: [step1Valid, step2Valid, step3Valid],
    finished: Boolean(published),
  });
  const currentStep = progress.clampedActiveStep;

  const stageSteps = [
    {
      step: 1 as const,
      code: "01",
      label: "Identity & Profile",
      state: progress.getState(1),
    },
    {
      step: 2 as const,
      code: "02",
      label: `Task Input Schema (${inputFieldNames.length})`,
      state: progress.getState(2),
    },
    {
      step: 3 as const,
      code: "03",
      label: "Contract Preview",
      state: progress.getState(3),
    },
    {
      step: 4 as const,
      code: "04",
      label: "Pricing & Payout",
      state: progress.getState(4),
    },
  ];

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep !== 4) return;
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
    if (!priceAtomic) {
      setError("Enter a valid positive fUSD price (up to 6 decimals).");
      return;
    }
    if (identityConflict) {
      setError(identityConflict.message);
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
          priceAtomic,
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
      setVerifyError("Enter a valid 0x 64-hex Avalanche transaction hash.");
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
            "Avalanche FacetActorRegistry verification failed.",
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

  const publishedIdentifier = published
    ? `${published.provider}/${published.facetName}@${published.version}`
    : null;
  const publishedRedirectHref = published
    ? buildMyFacetsRedirectHref({
        provider: published.provider,
        facetName: published.facetName,
        version: published.version,
        status: "PUBLISHED",
        facetType: "AGENT",
      })
    : null;

  useEffect(() => {
    if (!publishedIdentifier || !publishedRedirectHref) return;
    const timer = window.setTimeout(() => {
      window.location.assign(publishedRedirectHref);
    }, 1500);
    return () => window.clearTimeout(timer);
    // Intentionally schedule redirect once per published Agent identifier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedIdentifier]);

  return (
    <div className="agent-studio">
      {published && publishedIdentifier && publishedRedirectHref ? (
        <PublishRedirectToast
          identifier={publishedIdentifier}
          facetType="AGENT"
          status="PUBLISHED"
          targetHref={publishedRedirectHref}
          redirecting={true}
        />
      ) : null}
      <header className="studio-mode-header">
        <div>
          <div className="modality-pill-row">
            <span className="badge-type badge-modality-agent">
              ◈ FACET · AGENT
            </span>
            <span className="studio-mode-tag">
              On-Chain Identity Card · Avalanche
            </span>
          </div>
          <h1>Agent Studio</h1>
          <p>
            Bind an on-chain Agent identity on Avalanche, define the task
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

      <StudioStageBar
        ariaLabel="Agent onboarding pipeline"
        accent="agent"
        steps={stageSteps}
        onSelectStep={(step) => {
          setError(null);
          setActiveStep(step);
        }}
      />

      <form className="studio-workbench-grid" onSubmit={handlePublish}>
        <div className="studio-editor-pane">
          {currentStep === 1 ? (
            <fieldset className="studio-section-box">
              <legend>01 · Identity &amp; Profile</legend>
              <div className="studio-step-header">
                <span className="studio-step-kicker studio-step-kicker-agent">
                  Step 01 of 04 · Identity &amp; Profile
                </span>
                <h2 className="studio-step-title">
                  Configure Agent identity, SemVer, and Avalanche token binding
                </h2>
              </div>

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
                  <div className="version-input-row">
                    <input
                      id="agent-version"
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      pattern={SEMVER_PATTERN}
                      required
                    />
                    <button
                      type="button"
                      className="preset-chip"
                      onClick={() => setVersion((v) => bumpSemver(v, "patch"))}
                      title="Bump patch version"
                    >
                      +patch
                    </button>
                    <button
                      type="button"
                      className="preset-chip"
                      onClick={() => setVersion((v) => bumpSemver(v, "minor"))}
                      title="Bump minor version"
                    >
                      +minor
                    </button>
                  </div>
                </div>
                <div className="form-field">
                  <label htmlFor="agent-category">Category</label>
                  <select
                    id="agent-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    {getCategoryOptionsWithCurrent("AGENT", category).map(
                      (option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
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
                  <label htmlFor="agent-tags">Tags (comma-separated)</label>
                  <input
                    id="agent-tags"
                    value={tagsText}
                    onChange={(e) => setTagsText(e.target.value)}
                    placeholder="vietnam, agent, analytics"
                  />
                </div>
              </div>

              {identityConflict ? (
                <div
                  className="error-banner identity-conflict-banner"
                  role="alert"
                >
                  <div>
                    <strong>Duplicate Facet Identity</strong>
                    <p>{identityConflict.message}</p>
                  </div>
                  {identityConflict.suggestedVersion ? (
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        setError(null);
                        setVersion(identityConflict.suggestedVersion!);
                      }}
                    >
                      Use v{identityConflict.suggestedVersion}
                    </button>
                  ) : null}
                </div>
              ) : null}

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

              <div className="studio-grid">
                <div className="form-field">
                  <label htmlFor="agent-identity-id">
                    Agent Identity Token ID (Avalanche)
                  </label>
                  <input
                    id="agent-identity-id"
                    value={erc8004TokenId}
                    onChange={(e) => setErc8004TokenId(e.target.value)}
                    pattern="^[1-9][0-9]*$"
                    required
                  />
                  <small>
                    Positive nonzero token ID minted on the Avalanche Agent
                    Identity Registry.
                  </small>
                </div>
                <div className="form-field">
                  <label htmlFor="agent-identity-registry">
                    Agent Identity Registry (Avalanche 43113)
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
                    Use <code>vn-market-analysis</code> for live execution on
                    the built-in Avalanche runner.
                  </small>
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

              <div className="studio-step-footer">
                {step1BlockReason ? (
                  <span className="studio-step-hint">{step1BlockReason}</span>
                ) : null}
                <div className="studio-step-footer-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!step1Valid}
                    onClick={() => {
                      setError(null);
                      setCompletedUpTo((prev) => Math.max(prev, 1));
                      setActiveStep(2);
                    }}
                  >
                    Continue to Task Input Schema →
                  </button>
                </div>
              </div>
            </fieldset>
          ) : null}

          {currentStep === 2 ? (
            <fieldset className="studio-section-box">
              <legend>02 · A2A Task Input Schema</legend>
              <div className="studio-step-header">
                <span className="studio-step-kicker studio-step-kicker-agent">
                  Step 02 of 04 · Task Input Schema
                </span>
                <h2 className="studio-step-title">
                  Define structured delegation inputs
                </h2>
              </div>

              <InputSchemaBuilder
                value={inputSchemaText}
                onChange={setInputSchemaText}
                disabled={submitting}
                idPrefix="agent-schema"
              />

              <div className="studio-step-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setError(null);
                    setActiveStep(1);
                  }}
                >
                  ← Back
                </button>
                {step2BlockReason ? (
                  <span className="studio-step-hint">{step2BlockReason}</span>
                ) : null}
                <div className="studio-step-footer-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!step2Valid}
                    onClick={() => {
                      setError(null);
                      setCompletedUpTo((prev) => Math.max(prev, 2));
                      setActiveStep(3);
                    }}
                  >
                    Continue to Contract Preview →
                  </button>
                </div>
              </div>
            </fieldset>
          ) : null}

          {currentStep === 3 ? (
            <fieldset className="studio-section-box">
              <legend>03 · Contract Preview</legend>
              <div className="studio-step-header">
                <span className="studio-step-kicker studio-step-kicker-agent">
                  Step 03 of 04 · Contract Preview
                </span>
                <h2 className="studio-step-title">
                  Inspect A2A delegation contract before pricing
                </h2>
              </div>

              <dl className="inspector-specs">
                <div>
                  <dt>Target Facet</dt>
                  <dd>
                    {workspace.username ?? "your-account"}/{facetName}@{version}
                  </dd>
                </div>
                <div>
                  <dt>Category</dt>
                  <dd>{getCategoryLabel(category, "AGENT")}</dd>
                </div>
                <div>
                  <dt>On-Chain Identity</dt>
                  <dd>
                    #{erc8004TokenId} · {taskKind}
                  </dd>
                </div>
                <div>
                  <dt>Input Fields</dt>
                  <dd>
                    {inputFieldNames.length} field
                    {inputFieldNames.length === 1 ? "" : "s"} (
                    {inputFieldNames.join(", ") || "none"})
                  </dd>
                </div>
              </dl>

              <div className="actor-preview-result-box">
                <span className="eyebrow">
                  A2A Task Schema Contract Preview
                </span>
                <pre className="mono-detail actor-preview-output">
                  {JSON.stringify(
                    {
                      provider: workspace.username ?? "your-account",
                      facetName,
                      facetDisplayName,
                      version,
                      category,
                      taskKind,
                      identityTokenId: erc8004TokenId,
                      inputSchema: parsedSchema.schema,
                    },
                    null,
                    2,
                  )}
                </pre>
              </div>

              <div className="studio-step-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setError(null);
                    setActiveStep(2);
                  }}
                >
                  ← Back
                </button>
                {step3BlockReason ? (
                  <span className="studio-step-hint">{step3BlockReason}</span>
                ) : null}
                <div className="studio-step-footer-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    disabled={!step3Valid}
                    onClick={() => {
                      setError(null);
                      setCompletedUpTo((prev) => Math.max(prev, 3));
                      setActiveStep(4);
                    }}
                  >
                    Continue to Pricing &amp; Payout →
                  </button>
                </div>
              </div>
            </fieldset>
          ) : null}

          {currentStep === 4 ? (
            <fieldset className="studio-section-box">
              <legend>04 · Pricing &amp; Payout</legend>
              <div className="studio-step-header">
                <span className="studio-step-kicker studio-step-kicker-agent">
                  Step 04 of 04 · Pricing &amp; Payout
                </span>
                <h2 className="studio-step-title">
                  Configure price, payout wallet, and publish Agent
                </h2>
              </div>

              <FacetPricingFields
                idPrefix="agent"
                pricingModel={pricingModel}
                priceFusdText={priceFusdText}
                onPriceFusdChange={setPriceFusdText}
                disabled={submitting}
              />

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
                {payTo.trim() && !isValidEvmAddress(payTo) ? (
                  <small className="field-warning">
                    Enter a valid 0x EVM address or leave blank to use your
                    linked payout wallet.
                  </small>
                ) : null}
              </div>

              {error ? (
                <div className="error-banner" role="alert">
                  <strong>Registration error</strong>
                  <p>{error}</p>
                </div>
              ) : null}

              <div className="studio-step-footer">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={() => {
                    setError(null);
                    setActiveStep(3);
                  }}
                >
                  ← Back
                </button>
                <div className="studio-step-footer-actions">
                  <button
                    type="submit"
                    className="button button-primary"
                    disabled={
                      submitting ||
                      workspace.authRequired ||
                      workspace.usernameRequired ||
                      !priceAtomic ||
                      Boolean(payTo.trim() && !isValidEvmAddress(payTo)) ||
                      Boolean(identityConflict) ||
                      !step1Valid ||
                      !step2Valid
                    }
                  >
                    {submitting ? "Publishing Agent…" : "Publish Agent"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            </fieldset>
          ) : null}
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
            priceAtomic={priceAtomic ?? "1000"}
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
                  Verify Avalanche FacetActorRegistry Tx (optional)
                </label>
                <div className="verify-tx-row">
                  <input
                    id="agent-verify-tx"
                    value={verifyTxInput}
                    onChange={(e) => setVerifyTxInput(e.target.value)}
                    placeholder="0x... Avalanche tx hash"
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
                    Verified on Avalanche ✓{" "}
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
