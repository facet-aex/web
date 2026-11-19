"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { createWalletClient, custom } from "viem";

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
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import {
  FACET_NAME_PATTERN,
  SEMVER_PATTERN,
  bumpSemver,
  suggestFacetName,
} from "@/lib/identifiers";
import {
  parseInputSchemaText,
  schemaToVisualFields,
} from "@/lib/input-schema-builder";
import { readErrorEnvelope } from "@/lib/openapi-import";
import { useAccountWorkspace } from "@/lib/use-account-workspace";

type ActorEditorTab = "source" | "schema" | "pricing";

const ALL_ACTOR_PRESETS: ActorTemplatePreset[] = [
  BLANK_ACTOR_PRESET,
  ...ACTOR_TEMPLATE_PRESETS,
];

export function ActorStudio({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  const workspace = useAccountWorkspace();
  const initialPreset = ACTOR_TEMPLATE_PRESETS[0]!;

  const [activePresetId, setActivePresetId] = useState(initialPreset.id);
  const [editorTab, setEditorTab] = useState<ActorEditorTab>("source");

  const [facetDisplayName, setFacetDisplayName] = useState(
    initialPreset.facetDisplayName,
  );
  const [facetName, setFacetName] = useState(initialPreset.facetName);
  const [version, setVersion] = useState("1.0.0");
  const [facetNameLocked, setFacetNameLocked] = useState(true);
  const [summary, setSummary] = useState(initialPreset.summary);
  const [category, setCategory] = useState(initialPreset.category);
  const [tagsText, setTagsText] = useState(initialPreset.tags.join(", "));
  const [description, setDescription] = useState(initialPreset.description);
  const pricingModel = "PAY_PER_RUN";
  const priceAtomic = "1000";
  const [inputSchemaText, setInputSchemaText] = useState(
    JSON.stringify(initialPreset.inputSchema, null, 2),
  );
  const [code, setCode] = useState(initialPreset.code);

  const [verifiedWallet, setVerifiedWallet] = useState<string | null>(null);
  const [linkingWallet, setLinkingWallet] = useState(false);
  const [previewInput, setPreviewInput] = useState('{"query":"example"}');
  const [previewResult, setPreviewResult] = useState<string | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const publishKey = useRef<string | null>(null);
  const [ownedActors, setOwnedActors] = useState<
    Array<{
      provider: string;
      facetName: string;
      facetDisplayName: string;
      version: string;
      status: string;
    }>
  >([]);

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

  const payoutWallet =
    verifiedWallet ??
    (workspace.walletVerified ? workspace.walletAddress : null);

  useEffect(() => {
    if (!workspace.username) return;
    const controller = new AbortController();
    void fetch("/api/facet/actors/mine", {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{ actors: typeof ownedActors }>)
          : { actors: [] },
      )
      .then((body) => {
        if (!controller.signal.aborted) setOwnedActors(body.actors);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [workspace.username, published?.status]);

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

  function applyPreset(preset: ActorTemplatePreset) {
    publishKey.current = null;
    setActivePresetId(preset.id);
    setFacetDisplayName(preset.facetDisplayName);
    setFacetName(preset.facetName);
    setFacetNameLocked(true);
    setSummary(preset.summary);
    setCategory(preset.category);
    setTagsText(preset.tags.join(", "));
    setDescription(preset.description);
    setInputSchemaText(JSON.stringify(preset.inputSchema, null, 2));
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
  const codeLineCount = Math.max(code.split("\n").length, 1);

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

    const tags = tagsText
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
          ...(tags.length ? { tags } : {}),
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

      <form
        className="studio-workbench-grid"
        onSubmit={handlePublish}
        onChange={() => {
          publishKey.current = null;
        }}
      >
        <div className="studio-editor-pane">
          <div className="studio-identity-bar">
            <div className="form-field">
              <label htmlFor="actor-name">Actor Title</label>
              <input
                id="actor-name"
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
              <label htmlFor="actor-slug">Facet Name (kebab-case)</label>
              <input
                id="actor-slug"
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
              <label htmlFor="actor-version">Version (SemVer)</label>
              <div className="verify-tx-row">
                <input
                  id="actor-version"
                  value={version}
                  onChange={(event) => setVersion(event.target.value)}
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
              <input
                id="actor-category"
                list="actor-category-presets"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                maxLength={80}
                required
              />
              <datalist id="actor-category-presets">
                {STORE_CATEGORY_FILTERS.ACTOR.filter(
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
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPreviewResult(null);
                    }}
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
                {previewResult ? (
                  <pre className="mono-detail" role="status">
                    {previewResult}
                  </pre>
                ) : null}
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
                onChange={(value) => {
                  setInputSchemaText(value);
                  setPreviewResult(null);
                }}
                disabled={submitting}
                idPrefix="actor-schema"
              />
            </div>
          ) : null}

          {editorTab === "pricing" ? (
            <div className="studio-tab-panel">
              <p>
                PAY_PER_RUN · 1,000 atomic fUSD ({formatAtomicFusd(priceAtomic)}
                ) on Avalanche Fuji. The verified wallet below receives the
                creator payout.
              </p>
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
                <dd>{formatAtomicFusd(priceAtomic)} / run</dd>
              </div>
            </dl>
          </div>

          <div className="inspector-card">
            <p className="eyebrow">Publish Readiness</p>
            <ul className="readiness-list">
              <li
                data-ok={Boolean(
                  workspace.username &&
                  !workspace.authRequired &&
                  !workspace.usernameRequired,
                )}
              >
                {workspace.authRequired
                  ? "○ Sign in with Clerk required to publish"
                  : workspace.usernameRequired
                    ? "○ Valid 8–16 char kebab-case username required"
                    : workspace.username
                      ? `✓ Account @${workspace.username} ready`
                      : workspace.error
                        ? `○ ${workspace.error}`
                        : "○ Checking signed-in account…"}
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
              <li data-ok={Boolean(payoutWallet)}>
                {payoutWallet
                  ? "✓ Payout wallet verified"
                  : "○ Link payout wallet"}
              </li>
              <li data-ok={Boolean(previewResult)}>
                {previewResult
                  ? "✓ Docker preview completed"
                  : "○ Run Docker preview"}
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
              disabled={
                submitting ||
                workspace.authRequired ||
                !payoutWallet ||
                !previewResult
              }
            >
              {submitting ? "Publishing Actor…" : "Publish Actor"}
              <span aria-hidden="true">↗</span>
            </button>
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
            </div>
          ) : null}
        </aside>
      </form>
    </div>
  );
}
