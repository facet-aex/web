"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createWalletClient, custom } from "viem";

import { FacetPricingFields } from "@/components/facet-pricing-fields";
import { InputSchemaBuilder } from "@/components/input-schema-builder";
import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import {
  PublishRedirectToast,
  buildMyFacetsRedirectHref,
} from "@/components/publish-redirect-toast";
import { StudioFacetPreviewCard } from "@/components/studio-facet-preview-card";
import {
  StudioStageBar,
  computeStudioProgress,
} from "@/components/studio-stage-bar";
import {
  ACTOR_TEMPLATE_PRESETS,
  BLANK_ACTOR_PRESET,
  type ActorTemplatePreset,
} from "@/lib/actor-templates";
import {
  atomicToFusdInput,
  formatAtomicFusd,
  getCategoryOptionsWithCurrent,
  parseFusdToAtomic,
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

const ALL_ACTOR_PRESETS: ActorTemplatePreset[] = [
  BLANK_ACTOR_PRESET,
  ...ACTOR_TEMPLATE_PRESETS,
];

function buildDefaultPreviewInput(schema: Record<string, unknown>): string {
  const properties = schema.properties;
  if (
    typeof properties !== "object" ||
    properties === null ||
    Array.isArray(properties)
  ) {
    return "{}";
  }
  const sample: Record<string, unknown> = {};
  for (const [key, rawField] of Object.entries(properties)) {
    if (
      typeof rawField === "object" &&
      rawField !== null &&
      !Array.isArray(rawField) &&
      "default" in rawField &&
      rawField.default !== undefined
    ) {
      sample[key] = rawField.default;
    }
  }
  return Object.keys(sample).length > 0
    ? JSON.stringify(sample, null, 2)
    : "{}";
}

export function ActorStudio({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  const workspace = useAccountWorkspace();
  const initialPreset = BLANK_ACTOR_PRESET;

  const [activePresetId, setActivePresetId] = useState(initialPreset.id);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3 | 4>(1);
  const [completedUpTo, setCompletedUpTo] = useState(0);

  const [facetDisplayName, setFacetDisplayName] = useState(
    initialPreset.facetDisplayName,
  );
  const [facetName, setFacetName] = useState(initialPreset.facetName);
  const [version, setVersion] = useState("1.0.0");
  const [facetNameLocked, setFacetNameLocked] = useState(
    Boolean(initialPreset.facetName),
  );
  const [summary, setSummary] = useState(initialPreset.summary);
  const [category, setCategory] = useState(initialPreset.category);
  const [tagsText, setTagsText] = useState(initialPreset.tags.join(", "));
  const [description, setDescription] = useState(initialPreset.description);
  const pricingModel = "PAY_PER_RUN" as const;
  const [priceFusdText, setPriceFusdText] = useState(
    atomicToFusdInput(initialPreset.priceAtomic),
  );
  const priceAtomic = parseFusdToAtomic(priceFusdText);
  const [inputSchemaText, setInputSchemaText] = useState(
    JSON.stringify(initialPreset.inputSchema, null, 2),
  );
  const [code, setCode] = useState(initialPreset.code);

  const [verifiedWallet, setVerifiedWallet] = useState<string | null>(null);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [previewInput, setPreviewInput] = useState(() =>
    buildDefaultPreviewInput(initialPreset.inputSchema),
  );
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const publishKey = useRef<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<{
    provider: string;
    facetName: string;
    facetDisplayName: string;
    version: string;
    imageDigest: string;
    status: "REGISTRATION_PENDING" | "PUBLISHED" | "FAILED";
    registryTxHash?: string;
    errorCode?: string;
  } | null>(null);

  const ownedFacets = useOwnedFacets(workspace.username, published?.status);
  const ownedActors = ownedFacets.filter((item) => item.facetType === "ACTOR");

  const payoutWallet =
    verifiedWallet ??
    (workspace.walletVerified ? workspace.walletAddress : null);

  useEffect(() => {
    if (!published || published.status !== "REGISTRATION_PENDING") return;
    const controller = new AbortController();
    const timer = window.setInterval(async () => {
      try {
        const response = await fetch(
          `/api/facet/actors/${encodeURIComponent(published.provider)}/${encodeURIComponent(published.facetName)}/versions/${encodeURIComponent(published.version)}/publish-status`,
          { cache: "no-store", signal: controller.signal },
        );
        if (!response.ok) return;
        const status = (await response.json()) as {
          status?: string;
          registryTxHash?: string;
          errorCode?: string;
        };
        if (status.status === "PUBLISHED" || status.status === "FAILED") {
          setPublished((previous) =>
            previous
              ? {
                  ...previous,
                  status: status.status as "PUBLISHED" | "FAILED",
                  ...(status.registryTxHash
                    ? { registryTxHash: status.registryTxHash }
                    : {}),
                  ...(status.errorCode ? { errorCode: status.errorCode } : {}),
                }
              : previous,
          );
        }
      } catch {
        /* Poll again while the page remains open. */
      }
    }, 3000);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [published]);

  const publishedIdentifier = published
    ? `${published.provider}/${published.facetName}@${published.version}`
    : null;
  const publishedRedirectHref = published
    ? buildMyFacetsRedirectHref({
        provider: published.provider,
        facetName: published.facetName,
        version: published.version,
        status: published.status,
        facetType: "ACTOR",
      })
    : null;

  useEffect(() => {
    if (!publishedIdentifier || !publishedRedirectHref) return;
    const timer = window.setTimeout(() => {
      window.location.assign(publishedRedirectHref);
    }, 1500);
    return () => window.clearTimeout(timer);
    // Intentionally schedule redirect once per submitted Facet identifier.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publishedIdentifier]);

  function applyPreset(preset: ActorTemplatePreset) {
    publishKey.current = null;
    setActivePresetId(preset.id);
    setActiveStep(1);
    setCompletedUpTo(0);
    setFacetDisplayName(preset.facetDisplayName);
    setFacetName(preset.facetName);
    setVersion("1.0.0");
    setFacetNameLocked(Boolean(preset.facetName));
    setSummary(preset.summary);
    setCategory(preset.category);
    setTagsText(preset.tags.join(", "));
    setDescription(preset.description);
    setPriceFusdText(atomicToFusdInput(preset.priceAtomic));
    setInputSchemaText(JSON.stringify(preset.inputSchema, null, 2));
    setPreviewInput(buildDefaultPreviewInput(preset.inputSchema));
    setCode(preset.code);
    setError(null);
    setPublished(null);
    setPreviewResult(null);
  }

  const parsedSchema = parseInputSchemaText(inputSchemaText);
  const extractedFields = parsedSchema.schema
    ? schemaToVisualFields(parsedSchema.schema)
    : { editable: false, fields: [] };
  const hasEntrypointExport =
    /(export\s+default\b|export\s+(?:async\s+)?function\s+run\b)/u.test(
      code.trim(),
    );
  const codeLineCount = code.length === 0 ? 0 : code.split("\n").length;

  const identityConflict = checkFacetIdentityConflict(ownedFacets, {
    facetName,
    version,
    facetType: "ACTOR",
  });
  const tags = tagsText
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 20);
  const previewInputFields =
    extractedFields.fields.length > 0
      ? extractedFields.fields.map((field) => field.name)
      : parsedSchema.schema &&
          typeof parsedSchema.schema.properties === "object" &&
          parsedSchema.schema.properties !== null
        ? Object.keys(parsedSchema.schema.properties)
        : [];

  const step1BlockReason = !facetDisplayName.trim()
    ? "Enter an Actor Title before continuing."
    : !isValidFacetName(facetName.trim())
      ? "Facet Name must be 4–32 lowercase letters, numbers, or hyphens."
      : !isValidSemver(version.trim())
        ? "Version must follow SemVer (for example, 1.0.0)."
        : identityConflict
          ? identityConflict.message
          : !category.trim()
            ? "Select a Category before continuing."
            : !description.trim()
              ? "Enter a Full Description before continuing."
              : !hasEntrypointExport
                ? "Code must export a default function or named run(input)."
                : null;
  const step1Valid = step1BlockReason === null;

  const step2Valid = Boolean(parsedSchema.schema);
  const step2BlockReason = step2Valid
    ? null
    : (parsedSchema.error ?? "Fix JSON Schema syntax before continuing.");

  const step3Valid = Boolean(previewResult);
  const step3BlockReason = step3Valid
    ? null
    : "Run a successful Docker preview before continuing to Pricing & Payout.";

  const progress = computeStudioProgress({
    activeStep,
    completedUpTo,
    stepValidities: [step1Valid, step2Valid, step3Valid],
    finished: published?.status === "PUBLISHED",
  });
  const currentStep = progress.clampedActiveStep;

  const stageSteps = [
    {
      step: 1 as const,
      code: "01",
      label: "Source & Metadata",
      state: progress.getState(1),
    },
    {
      step: 2 as const,
      code: "02",
      label: `Input Schema (${extractedFields.fields.length})`,
      state: progress.getState(2),
    },
    {
      step: 3 as const,
      code: "03",
      label: "Docker Preview",
      state: progress.getState(3),
    },
    {
      step: 4 as const,
      code: "04",
      label: "Pricing & Payout",
      state: progress.getState(4),
    },
  ];

  async function handleLinkWallet() {
    setError(null);
    setLinkingWallet(true);
    try {
      const account = workspace.user ?? (await workspace.refresh());
      if (!account?.username) {
        if (workspace.usernameRequired) {
          throw new Error(
            "Update your Clerk username to 8–16 lowercase letters, numbers, and hyphens (-) before linking a payout wallet.",
          );
        }
        if (workspace.error && !workspace.authRequired) {
          throw new Error(workspace.error);
        }
        throw new Error("Sign in before linking a payout wallet.");
      }
      const injected = (
        window as Window & {
          ethereum?: {
            request: (args: {
              method: string;
              params?: unknown[];
            }) => Promise<unknown>;
          };
        }
      ).ethereum;
      if (!injected)
        throw new Error(
          "Install or open an EVM wallet to sign the payout challenge.",
        );
      const wallet = createWalletClient({ transport: custom(injected) });
      const [address] = await wallet.requestAddresses();
      if (!address) throw new Error("Select a payout address in your wallet.");
      const challengeResponse = await fetch(
        `/api/facet/providers/${encodeURIComponent(account.username)}/wallet-link-challenges`,
        { method: "POST" },
      );
      const challenge = (await challengeResponse.json()) as {
        challengeId?: string;
        message?: string;
        error?: { message?: string };
      };
      if (!challengeResponse.ok || !challenge.challengeId || !challenge.message)
        throw new Error(challenge.error?.message ?? "Wallet challenge failed.");
      const signature = await wallet.signMessage({
        account: address,
        message: challenge.message,
      });
      const confirmation = await fetch(
        `/api/facet/providers/${encodeURIComponent(account.username)}/wallet-link`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            challengeId: challenge.challengeId,
            address,
            signature,
          }),
        },
      );
      const linked = (await confirmation.json()) as {
        walletAddress?: string;
        error?: { message?: string };
      };
      if (!confirmation.ok || !linked.walletAddress)
        throw new Error(linked.error?.message ?? "Wallet link failed.");
      setVerifiedWallet(linked.walletAddress);
      await workspace.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not link payout wallet.",
      );
    } finally {
      setLinkingWallet(false);
    }
  }

  async function handlePreview() {
    setError(null);
    setPreviewing(true);
    try {
      if (workspace.authRequired)
        throw new Error("Sign in before previewing an Actor.");
      if (workspace.usernameRequired)
        throw new Error(
          "Update your Clerk username to 8–16 lowercase letters, numbers, and hyphens (-) before previewing an Actor.",
        );
      if (!parsedSchema.schema)
        throw new Error(parsedSchema.error ?? "Input schema is invalid.");
      const input = JSON.parse(previewInput) as unknown;
      if (!input || typeof input !== "object" || Array.isArray(input))
        throw new Error("Preview input must be a JSON object.");
      const response = await fetch("/api/facet/actors/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          code,
          inputSchema: parsedSchema.schema,
          input,
        }),
      });
      const result = (await response.json()) as {
        result?: unknown;
        dataset?: unknown;
        usage?: unknown;
        error?: { message?: string };
      };
      if (!response.ok)
        throw new Error(result.error?.message ?? "Docker preview failed.");
      setPreviewResult(
        JSON.stringify(
          {
            result: result.result,
            dataset: result.dataset,
            usage: result.usage,
          },
          null,
          2,
        ),
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not preview Actor.",
      );
    } finally {
      setPreviewing(false);
    }
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (currentStep !== 4) return;
    setError(null);
    setPublished(null);

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
    if (!payoutWallet) {
      setError("Link and verify your payout wallet before publishing.");
      return;
    }
    if (!previewResult) {
      setError("Run a Docker preview before publishing.");
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

    const requestTags = tagsText
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 20);

    setSubmitting(true);
    try {
      const account = workspace.user ?? (await workspace.refresh());
      if (!account?.username) {
        throw new Error(
          workspace.authRequired
            ? "Sign in with Clerk to publish capabilities under your account."
            : (workspace.error ?? "Your FACET account is not ready."),
        );
      }

      const response = await fetch("/api/facet/actors", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": (publishKey.current ??= crypto.randomUUID()),
        },
        body: JSON.stringify({
          facetName: facetName.trim(),
          facetDisplayName: facetDisplayName.trim(),
          version: version.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
          description: description.trim(),
          category: category.trim(),
          ...(requestTags.length ? { tags: requestTags } : {}),
          inputSchema: parsedSchema.schema,
          code,
          pricingModel,
          priceAtomic,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        facet?: {
          provider: string;
          facetName: string;
          facetDisplayName: string;
          version: string;
          imageDigest?: string;
          status?: "REGISTRATION_PENDING" | "PUBLISHED" | "FAILED";
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
        provider: body.facet.provider,
        facetName: body.facet.facetName,
        facetDisplayName: body.facet.facetDisplayName,
        version: body.facet.version,
        imageDigest: body.facet.imageDigest ?? "sha256:computed",
        status: body.facet.status ?? "REGISTRATION_PENDING",
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish Actor.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="actor-studio">
      {published && publishedIdentifier && publishedRedirectHref ? (
        <PublishRedirectToast
          identifier={publishedIdentifier}
          facetType="ACTOR"
          status={published.status}
          targetHref={publishedRedirectHref}
          redirecting={true}
        />
      ) : null}
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

      <StudioStageBar
        ariaLabel="Actor onboarding pipeline"
        accent="actor"
        steps={stageSteps}
        onSelectStep={(step) => {
          setError(null);
          setActiveStep(step);
        }}
      />

      <form
        className="studio-workbench-grid"
        onSubmit={handlePublish}
        onChange={() => {
          publishKey.current = null;
        }}
      >
        <div className="studio-editor-pane">
          {currentStep === 1 ? (
            <div className="studio-tab-panel">
              <div className="studio-step-header">
                <span className="studio-step-kicker">
                  Step 01 of 04 · Source &amp; Metadata
                </span>
                <h2 className="studio-step-title">
                  Configure Actor identity and ESM entrypoint
                </h2>
              </div>

              <div className="studio-grid">
                <div className="form-field">
                  <label htmlFor="actor-name">Actor Title</label>
                  <input
                    id="actor-name"
                    value={facetDisplayName}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setFacetDisplayName(nextName);
                      if (!facetNameLocked) {
                        setFacetName(
                          nextName.trim() ? suggestFacetName(nextName) : "",
                        );
                      }
                    }}
                    placeholder="e.g. HTML Product Extractor"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="actor-slug">Facet Name (kebab-case)</label>
                  <input
                    id="actor-slug"
                    value={facetName}
                    onChange={(e) => {
                      setFacetNameLocked(true);
                      setFacetName(e.target.value);
                    }}
                    placeholder="e.g. html-product-extractor"
                    pattern={FACET_NAME_PATTERN}
                    minLength={4}
                    maxLength={32}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="actor-version">Version (SemVer)</label>
                  <div className="version-input-row">
                    <input
                      id="actor-version"
                      value={version}
                      onChange={(event) => setVersion(event.target.value)}
                      placeholder="1.0.0"
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
                  <label htmlFor="actor-category">Category</label>
                  <select
                    id="actor-category"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    required
                  >
                    <option value="" disabled>
                      Select a category…
                    </option>
                    {getCategoryOptionsWithCurrent("ACTOR", category).map(
                      (option) => (
                        <option key={option.slug} value={option.slug}>
                          {option.label}
                        </option>
                      ),
                    )}
                  </select>
                </div>
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
                <label htmlFor="actor-description">Full Description</label>
                <input
                  id="actor-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what this Actor accepts, processes, and returns."
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
                    {Array.from(
                      { length: Math.max(codeLineCount, 1) },
                      (_, idx) => (
                        <span key={idx + 1}>{idx + 1}</span>
                      ),
                    )}
                  </div>
                  <textarea
                    id="actor-code"
                    aria-label="Actor JavaScript Code (main.mjs)"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPreviewResult(null);
                      setCompletedUpTo((prev) => Math.min(prev, 2));
                    }}
                    placeholder={
                      "export default async function run(input) {\n  return [{ ok: true, input }];\n}"
                    }
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
                    Continue to Input Schema →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 2 ? (
            <div className="studio-tab-panel">
              <div className="studio-step-header">
                <span className="studio-step-kicker">
                  Step 02 of 04 · Input Schema ({extractedFields.fields.length}{" "}
                  fields)
                </span>
                <h2 className="studio-step-title">
                  Define the JSON Schema 2020-12 input contract
                </h2>
              </div>
              <p className="panel-intro">
                The Store automatically generates an interactive form from this
                schema, and the Gateway validates every paid request against it.
              </p>
              <InputSchemaBuilder
                value={inputSchemaText}
                onChange={(value) => {
                  setInputSchemaText(value);
                  setPreviewResult(null);
                  setCompletedUpTo((prev) => Math.min(prev, 2));
                }}
                disabled={submitting}
                idPrefix="actor-schema"
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
                    Continue to Docker Preview →
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {currentStep === 3 ? (
            <div className="studio-tab-panel">
              <div className="studio-step-header">
                <span className="studio-step-kicker">
                  Step 03 of 04 · Docker Preview
                </span>
                <h2 className="studio-step-title">
                  Verify execution inside the isolated runner
                </h2>
              </div>
              <p className="panel-intro">
                Run a dry-run inside <code>facet/node-actor-runner:1.0</code>{" "}
                with <code>--network=none</code> and confirm structured dataset
                output before unlocking Pricing &amp; Payout.
              </p>
              <div className="form-field">
                <label htmlFor="actor-preview-input">
                  Docker preview input (JSON)
                </label>
                <textarea
                  id="actor-preview-input"
                  value={previewInput}
                  onChange={(event) => setPreviewInput(event.target.value)}
                  rows={4}
                />
                <button
                  type="button"
                  className="button button-secondary"
                  disabled={previewing || workspace.authRequired}
                  onClick={() => void handlePreview()}
                >
                  {previewing
                    ? "Running Docker preview…"
                    : "Run Docker preview"}
                </button>
              </div>
              {error ? (
                <div className="error-banner" role="alert">
                  <strong>Preview error</strong>
                  <p>{error}</p>
                </div>
              ) : null}
              {previewResult ? (
                <div className="actor-preview-result-box">
                  <span className="eyebrow">Docker preview output</span>
                  <pre
                    className="mono-detail actor-preview-output"
                    role="status"
                  >
                    {previewResult}
                  </pre>
                </div>
              ) : null}
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
            </div>
          ) : null}

          {currentStep === 4 ? (
            <div className="studio-tab-panel">
              <div className="studio-step-header">
                <span className="studio-step-kicker">
                  Step 04 of 04 · Pricing &amp; Payout
                </span>
                <h2 className="studio-step-title">
                  Configure price, payout wallet, and publish Actor
                </h2>
              </div>

              <FacetPricingFields
                idPrefix="actor"
                pricingModel={pricingModel}
                priceFusdText={priceFusdText}
                onPriceFusdChange={setPriceFusdText}
                disabled={submitting}
              />

              <dl className="inspector-specs">
                <div>
                  <dt>Target Facet</dt>
                  <dd>
                    {workspace.username ?? "your-account"}/{facetName}@{version}
                  </dd>
                </div>
                <div>
                  <dt>ESM Entrypoint</dt>
                  <dd>{codeLineCount} lines · export verified</dd>
                </div>
                <div>
                  <dt>Input Contract</dt>
                  <dd>
                    {extractedFields.fields.length} visual fields · JSON Schema
                    valid
                  </dd>
                </div>
                <div>
                  <dt>Docker Preview</dt>
                  <dd className="mono-accent">Verified ✓</dd>
                </div>
              </dl>
              <p className="mono-detail">
                {payoutWallet ?? "No payout wallet linked"}
              </p>
              <button
                type="button"
                className="button button-secondary"
                disabled={linkingWallet || workspace.authRequired}
                onClick={() => void handleLinkWallet()}
              >
                {linkingWallet
                  ? "Signing wallet challenge…"
                  : payoutWallet
                    ? "Change verified payout wallet"
                    : "Link payout wallet"}
              </button>
              {error ? (
                <div className="error-banner" role="alert">
                  <strong>Publish error</strong>
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
                      !payoutWallet ||
                      !previewResult ||
                      !priceAtomic ||
                      Boolean(identityConflict) ||
                      !step1Valid ||
                      !step2Valid
                    }
                  >
                    {submitting ? "Publishing Actor…" : "Publish Actor"}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </div>
            </div>
          ) : null}
        </div>

        <aside
          className="studio-inspector-pane"
          aria-label="Facet Preview and runtime summary"
        >
          <StudioFacetPreviewCard
            facetType="ACTOR"
            {...(workspace.username ? { provider: workspace.username } : {})}
            facetDisplayName={facetDisplayName}
            facetName={facetName}
            version={version}
            category={category}
            summary={summary}
            description={description}
            tags={tags}
            pricingModel={pricingModel}
            priceAtomic={priceAtomic}
            payoutWallet={payoutWallet}
            inputFields={previewInputFields}
            runtimeLabel="facet/node-actor-runner:1.0"
            codeLineCount={codeLineCount}
            hasEntrypointExport={hasEntrypointExport}
            previewPassed={Boolean(previewResult)}
            conflictMessage={identityConflict?.message ?? null}
          />

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
                  {priceAtomic ? `${formatAtomicFusd(priceAtomic)} / run` : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {published ? (
            <div className="published-card" role="status">
              <p className="eyebrow">
                {published.status === "PUBLISHED"
                  ? "Actor Published"
                  : published.status === "FAILED"
                    ? "Fuji Registration Failed"
                    : "Fuji Registration Pending"}
              </p>
              <strong>
                {published.provider}/{published.facetName}@{published.version}
              </strong>
              <p className="mono-detail">
                imageDigest: {published.imageDigest}
              </p>
              {published.status === "PUBLISHED" ? (
                <Link
                  className="button button-primary import-submit"
                  href={`/facets/${encodeURIComponent(published.provider)}/${encodeURIComponent(published.facetName)}`}
                >
                  Open &amp; Run in Playground <span aria-hidden="true">↗</span>
                </Link>
              ) : null}
              {published.registryTxHash ? (
                <a
                  className="explorer-link"
                  href={snowtraceTxUrl(published.registryTxHash)}
                  target="_blank"
                  rel="noreferrer"
                >
                  Fuji registry transaction ↗
                </a>
              ) : null}
              {published.errorCode ? (
                <p className="field-warning">{published.errorCode}</p>
              ) : null}
            </div>
          ) : null}
          {ownedActors.length ? (
            <div className="inspector-card">
              <p className="eyebrow">Your Actors</p>
              <ul className="readiness-list">
                {ownedActors.map((actor) => (
                  <li
                    key={`${actor.provider}/${actor.facetName}@${actor.version}`}
                  >
                    {actor.status === "PUBLISHED" ? (
                      <Link
                        href={`/facets/${encodeURIComponent(actor.provider)}/${encodeURIComponent(actor.facetName)}`}
                      >
                        {actor.provider}/{actor.facetName}
                      </Link>
                    ) : (
                      `${actor.provider}/${actor.facetName}`
                    )}
                    {" · v"}
                    {actor.version}
                    {" · "}
                    {actor.status}
                  </li>
                ))}
              </ul>
              <Link className="explorer-link" href="/my-facets">
                Manage all in My Facets ↗
              </Link>
            </div>
          ) : null}
        </aside>
      </form>
    </div>
  );
}
