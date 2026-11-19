"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { FacetPricingFields } from "@/components/facet-pricing-fields";
import {
  PublishRedirectToast,
  buildMyFacetsRedirectHref,
} from "@/components/publish-redirect-toast";

import {
  buildDraftSelections,
  readFacetDraftsResponse,
  readFacetPublicationResponse,
  readFacetValidationResponse,
  requiresManualAuthReview,
  SIDE_EFFECT_CLASSES,
  suggestEndpoint,
  type DraftSelection,
  type EndpointAuthKind,
  type FacetDraft,
  type FacetPublicationResult,
  type FacetValidationResult,
} from "@/lib/facet-draft-workflow";
import { getCategoryOptionsWithCurrent } from "@/lib/facet-ui";
import { FACET_NAME_PATTERN, suggestFacetName } from "@/lib/identifiers";
import {
  readErrorEnvelope,
  type OperationCandidate,
} from "@/lib/openapi-import";
import {
  checkFacetIdentityConflict,
  useOwnedFacets,
} from "@/lib/use-owned-facets";

interface FacetDraftWorkbenchProps {
  provider: string;
  importJobId: string;
  operations: OperationCandidate[];
  onDraftsCreated?: () => void;
  onAnyPublished?: () => void;
}

type WorkbenchStage =
  | "EDITING"
  | "DRAFT"
  | "CONFIGURING"
  | "CONFIGURED"
  | "VALIDATING"
  | "VALID"
  | "PUBLISHING"
  | "PUBLISHED";

type InspectorTab = "general" | "gateway" | "publish";

interface WorkbenchItem {
  operation: OperationCandidate;
  selection: DraftSelection;
  baseUrl: string;
  authKind: EndpointAuthKind;
  parameterName: string;
  secretLabel: string;
  secretValue: string;
  secretReference: string | null;
  authReviewRequired: boolean;
  draft: FacetDraft | null;
  revision: number | null;
  validation: FacetValidationResult | null;
  publication: FacetPublicationResult | null;
  publicationVisibility: "PUBLIC" | "UNLISTED";
  stage: WorkbenchStage;
  error: string | null;
}

function createItems(operations: OperationCandidate[]): WorkbenchItem[] {
  const selections = buildDraftSelections(operations);
  return operations.map((operation, index) => {
    const suggestion = suggestEndpoint(operation);
    return {
      operation,
      selection: selections[index]!,
      baseUrl: suggestion.baseUrl,
      authKind: suggestion.authKind,
      parameterName: suggestion.parameterName ?? "",
      secretLabel: `${selections[index]!.facetDisplayName} upstream credential`,
      secretValue: "",
      secretReference: null,
      authReviewRequired: requiresManualAuthReview(operation),
      draft: null,
      revision: null,
      validation: null,
      publication: null,
      publicationVisibility: "PUBLIC",
      stage: "EDITING",
      error: null,
    };
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readSecretId(value: unknown): string | null {
  if (!isRecord(value) || !isRecord(value.secret)) return null;
  return typeof value.secret.id === "string" ? value.secret.id : null;
}

function readConfiguredRevision(value: unknown): number | null {
  if (!isRecord(value) || !isRecord(value.endpointConfig)) return null;
  const revision = value.endpointConfig.facetVersionRevision;
  return typeof revision === "number" ? revision : null;
}

export function FacetDraftWorkbench({
  provider,
  importJobId,
  operations,
  onDraftsCreated,
  onAnyPublished,
}: FacetDraftWorkbenchProps) {
  const [items, setItems] = useState<WorkbenchItem[]>(() =>
    createItems(operations),
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [activeTab, setActiveTab] = useState<InspectorTab>("general");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [lastPublished, setLastPublished] = useState<{
    identifier: string;
    targetHref: string;
    autoRedirect: boolean;
  } | null>(null);

  useEffect(() => {
    if (!lastPublished?.autoRedirect) return;
    const timer = window.setTimeout(() => {
      window.location.assign(lastPublished.targetHref);
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [lastPublished]);

  const safeIndex = Math.min(activeIndex, Math.max(items.length - 1, 0));
  const activeItem = items[safeIndex];

  function updateItem(index: number, update: Partial<WorkbenchItem>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...update } : item,
      ),
    );
  }

  function updateSelection(index: number, update: Partial<DraftSelection>) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index
          ? { ...item, selection: { ...item.selection, ...update } }
          : item,
      ),
    );
  }

  async function createDrafts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!items.length || items.some((item) => item.draft)) return;
    setCreating(true);
    setCreateError(null);

    try {
      const response = await fetch("/api/facet/facets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          importJobId,
          selections: items.map((item) => item.selection),
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(readErrorEnvelope(body));
      const drafts = readFacetDraftsResponse(body);
      if (!drafts || drafts.length !== items.length) {
        throw new Error("The Control API returned an invalid draft batch.");
      }
      setItems((current) =>
        current.map((item, index) => ({
          ...item,
          draft: drafts[index]!,
          revision: drafts[index]!.draftVersion.revision,
          stage: "DRAFT",
          error: null,
        })),
      );
      setActiveTab("gateway");
      onDraftsCreated?.();
    } catch (error) {
      setCreateError(
        error instanceof Error
          ? error.message
          : "The Facet drafts could not be created.",
      );
    } finally {
      setCreating(false);
    }
  }

  async function configure(index: number) {
    const item = items[index];
    if (!item?.draft || item.revision === null) return;
    updateItem(index, { stage: "CONFIGURING", error: null });

    try {
      let secretRefId = item.secretReference ?? undefined;
      if (item.authKind !== "NONE") {
        if (!secretRefId && !item.secretValue) {
          throw new Error("Enter the upstream secret value.");
        }
        if (!secretRefId) {
          const targetProvider = provider || item.draft.provider;
          const secretResponse = await fetch(
            `/api/facet/providers/${encodeURIComponent(targetProvider)}/secrets`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                kind: item.authKind === "BEARER" ? "BEARER_TOKEN" : "API_KEY",
                label: item.secretLabel.trim(),
                value: item.secretValue,
              }),
            },
          );
          const secretBody = await readJson(secretResponse);
          if (!secretResponse.ok) {
            throw new Error(readErrorEnvelope(secretBody));
          }
          secretRefId = readSecretId(secretBody) ?? undefined;
          if (!secretRefId) {
            throw new Error(
              "The Control API returned invalid secret metadata.",
            );
          }
          updateItem(index, {
            secretValue: "",
            secretReference: secretRefId,
          });
        }
      }

      const configResponse = await fetch(
        `/api/facet/facets/${encodeURIComponent(item.draft.provider)}/${encodeURIComponent(item.draft.facetName)}/versions/${encodeURIComponent(item.draft.draftVersion.version)}/endpoint-config`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: item.revision,
            baseUrl: item.baseUrl.trim(),
            auth: {
              kind: item.authKind,
              ...(secretRefId ? { secretRefId } : {}),
              ...(item.authKind.startsWith("API_KEY")
                ? { parameterName: item.parameterName.trim() }
                : {}),
            },
            timeoutMs: 15_000,
            maxResponseBytes: 1_048_576,
            redirectPolicy: "DENY",
          }),
        },
      );
      const configBody = await readJson(configResponse);
      if (!configResponse.ok) {
        throw new Error(readErrorEnvelope(configBody));
      }
      const nextRevision = readConfiguredRevision(configBody);
      if (nextRevision === null) {
        throw new Error("The Control API returned invalid endpoint metadata.");
      }
      updateItem(index, {
        revision: nextRevision,
        stage: "CONFIGURED",
        error: null,
      });
      setActiveTab("publish");
    } catch (error) {
      updateItem(index, {
        stage: "DRAFT",
        error:
          error instanceof Error
            ? error.message
            : "The upstream endpoint could not be configured.",
      });
    }
  }

  async function validate(index: number, acknowledgeWarnings: boolean) {
    const item = items[index];
    if (!item?.draft || item.revision === null) return;
    updateItem(index, { stage: "VALIDATING", error: null });

    try {
      const warningAcknowledgements = acknowledgeWarnings
        ? (item.validation?.warnings ?? []).map((warning) => ({
            warningId: warning.warningId,
            reason: "Provider reviewed this warning in the FACET console.",
          }))
        : [];
      const response = await fetch(
        `/api/facet/facets/${encodeURIComponent(item.draft.provider)}/${encodeURIComponent(item.draft.facetName)}/versions/${encodeURIComponent(item.draft.draftVersion.version)}/validate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: item.revision,
            warningAcknowledgements,
          }),
        },
      );
      const body = await readJson(response);
      if (!response.ok) throw new Error(readErrorEnvelope(body));
      const validation = readFacetValidationResponse(body);
      if (!validation) {
        throw new Error(
          "The Control API returned an invalid validation result.",
        );
      }
      updateItem(index, {
        revision: validation.revision,
        validation,
        stage: validation.status === "VALID" ? "VALID" : "CONFIGURED",
        error: null,
      });
    } catch (error) {
      updateItem(index, {
        stage: "CONFIGURED",
        error:
          error instanceof Error
            ? error.message
            : "The Facet could not be validated.",
      });
    }
  }

  async function publish(index: number) {
    const item = items[index];
    if (!item?.draft || item.revision === null || item.stage !== "VALID")
      return;
    updateItem(index, { stage: "PUBLISHING", error: null });

    try {
      const response = await fetch(
        `/api/facet/facets/${encodeURIComponent(item.draft.provider)}/${encodeURIComponent(item.draft.facetName)}/versions/${encodeURIComponent(item.draft.draftVersion.version)}/publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            revision: item.revision,
            visibility: item.publicationVisibility,
          }),
        },
      );
      const body = await readJson(response);
      if (!response.ok) throw new Error(readErrorEnvelope(body));
      const publication = readFacetPublicationResponse(body);
      if (!publication) {
        throw new Error(
          "The Control API returned invalid publication metadata.",
        );
      }
      updateItem(index, {
        publication,
        revision: publication.revision,
        stage: "PUBLISHED",
        error: null,
      });
      const allPublished =
        items.length === 1 ||
        items.every(
          (entry, entryIndex) =>
            entryIndex === index || entry.stage === "PUBLISHED",
        );
      setLastPublished({
        identifier: `${publication.provider}/${publication.facetName}@${publication.version}`,
        targetHref: buildMyFacetsRedirectHref({
          provider: publication.provider,
          facetName: publication.facetName,
          version: publication.version,
          status: "PUBLISHED",
          facetType: "API",
        }),
        autoRedirect: allPublished,
      });
      onAnyPublished?.();
    } catch (error) {
      updateItem(index, {
        stage: "VALID",
        error:
          error instanceof Error
            ? error.message
            : "The Facet Version could not be published.",
      });
    }
  }

  const draftsCreated = items.length > 0 && items.every((item) => item.draft);
  const ownedFacets = useOwnedFacets(provider, lastPublished?.identifier);
  const batchNameCounts = new Map<string, number>();
  for (const entry of items) {
    const key = entry.selection.facetName.trim().toLowerCase();
    if (key) {
      batchNameCounts.set(key, (batchNameCounts.get(key) ?? 0) + 1);
    }
  }
  const itemConflicts = items.map((entry) => {
    const key = entry.selection.facetName.trim().toLowerCase();
    const ownedConflict = checkFacetIdentityConflict(ownedFacets, {
      facetName: entry.selection.facetName,
      version: "1.0.0",
      facetType: "API",
    });
    if (ownedConflict) return ownedConflict.message;
    if (key && (batchNameCounts.get(key) ?? 0) > 1) {
      return `Multiple endpoints in this import share Facet Name "${key}". Rename one before creating drafts.`;
    }
    return null;
  });
  const hasAnyPreDraftConflict =
    !draftsCreated && itemConflicts.some((msg) => msg !== null);
  const activeConflict = !draftsCreated
    ? (itemConflicts[safeIndex] ?? null)
    : null;

  const validCount = items.filter((item) =>
    ["VALID", "PUBLISHING", "PUBLISHED"].includes(item.stage),
  ).length;
  const publishedCount = items.filter(
    (item) => item.stage === "PUBLISHED",
  ).length;

  if (!activeItem) return null;
  const prefix = `facet-${activeItem.operation.id}`;
  const hasUnacknowledgedWarnings =
    activeItem.validation?.warnings.some((warning) => !warning.acknowledged) ??
    false;

  return (
    <form className="draft-workbench rapid-hub" onSubmit={createDrafts}>
      {lastPublished ? (
        <PublishRedirectToast
          identifier={lastPublished.identifier}
          facetType="API"
          status="PUBLISHED"
          targetHref={lastPublished.targetHref}
          redirecting={lastPublished.autoRedirect}
          onDismiss={() => setLastPublished(null)}
        />
      ) : null}
      <header className="draft-workbench-heading">
        <div>
          <p className="eyebrow">API Definition Workspace</p>
          <h3>Endpoint Definition Hub</h3>
        </div>
        <p>
          Review each endpoint&apos;s catalog copy, create your provider-private
          draft batch, map upstream base URL and secrets, then validate and
          publish to the Store.
        </p>
      </header>

      <ol className="draft-progress" aria-label="Facet draft progress">
        <li data-complete="true">01 · Imported ({items.length})</li>
        <li data-complete={draftsCreated}>
          02 · Drafts {draftsCreated ? "Locked" : "Pending"}
        </li>
        <li data-complete={validCount === items.length}>
          03 · Valid ({validCount}/{items.length})
        </li>
        <li data-complete={publishedCount === items.length}>
          04 · Published ({publishedCount}/{items.length})
        </li>
      </ol>

      <div className="rapid-two-pane">
        <aside className="rapid-endpoint-sidebar" aria-label="Endpoints list">
          <div className="rapid-sidebar-header">
            <span>Endpoints ({items.length})</span>
            <span>{draftsCreated ? "Drafts Ready" : "Pre-Draft"}</span>
          </div>
          <ul className="rapid-endpoint-list">
            {items.map((item, idx) => {
              const selected = idx === safeIndex;
              return (
                <li key={item.operation.id}>
                  <button
                    type="button"
                    className={`rapid-endpoint-btn ${selected ? "rapid-endpoint-active" : ""}`}
                    onClick={() => setActiveIndex(idx)}
                  >
                    <span className="rapid-endpoint-top">
                      <span className="operation-method">
                        {item.operation.method.toUpperCase()}
                      </span>
                      <span
                        className={`draft-stage draft-stage-${item.stage.toLowerCase()}`}
                      >
                        {item.stage}
                      </span>
                    </span>
                    <strong className="rapid-endpoint-path">
                      {item.operation.path}
                    </strong>
                    <small>{item.selection.facetDisplayName}</small>
                  </button>
                </li>
              );
            })}
          </ul>

          {!draftsCreated ? (
            <div className="rapid-sidebar-footer">
              <p>
                Review catalog metadata on the right, then create drafts to
                unlock Gateway &amp; Secret config.
              </p>
              <button
                className="button button-primary import-submit"
                type="submit"
                disabled={creating || !items.length || hasAnyPreDraftConflict}
              >
                {creating ? "Creating Drafts…" : "Create Facet Drafts"}
                <span aria-hidden="true">↗</span>
              </button>
              {hasAnyPreDraftConflict ? (
                <small className="field-warning">
                  Resolve duplicate Facet Name conflicts before creating drafts.
                </small>
              ) : null}
              {createError ? (
                <div className="error-banner" role="alert">
                  <strong>Draft creation needs attention</strong>
                  <p>{createError}</p>
                </div>
              ) : null}
            </div>
          ) : null}
        </aside>

        <div className="rapid-inspector-pane">
          <div className="rapid-inspector-header">
            <div className="rapid-inspector-title">
              <span className="operation-method">
                {activeItem.operation.method.toUpperCase()}
              </span>
              <div>
                <h4>{activeItem.operation.path}</h4>
                <p>
                  {activeItem.operation.summary ??
                    activeItem.operation.operationId ??
                    "API endpoint operation"}
                </p>
              </div>
            </div>
            <span
              className={`draft-stage draft-stage-${activeItem.stage.toLowerCase()}`}
            >
              {activeItem.stage}
            </span>
          </div>

          <div
            className="studio-tabs rapid-inspector-tabs"
            role="tablist"
            aria-label="Endpoint configuration tabs"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "general"}
              className={`tab-button ${activeTab === "general" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("general")}
            >
              General &amp; Catalog
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "gateway"}
              className={`tab-button ${activeTab === "gateway" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("gateway")}
            >
              Gateway &amp; Auth
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "publish"}
              className={`tab-button ${activeTab === "publish" ? "tab-active" : ""}`}
              onClick={() => setActiveTab("publish")}
            >
              Validate &amp; Publish
            </button>
          </div>

          {activeTab === "general" ? (
            <div className="rapid-tab-body">
              {draftsCreated ? (
                <p className="panel-intro">
                  Catalog metadata is locked after draft creation. Continue to{" "}
                  <strong>Gateway &amp; Auth</strong> to configure upstream
                  execution.
                </p>
              ) : null}
              {activeConflict ? (
                <div
                  className="error-banner identity-conflict-banner"
                  role="alert"
                >
                  <div>
                    <strong>Duplicate Facet Name</strong>
                    <p>{activeConflict}</p>
                  </div>
                </div>
              ) : null}
              <div className="draft-fields">
                <div className="form-field">
                  <label htmlFor={`draft-name-${prefix}`}>
                    Facet Display Name
                  </label>
                  <input
                    id={`draft-name-${prefix}`}
                    value={activeItem.selection.facetDisplayName}
                    onChange={(event) => {
                      const nextDisplay = event.target.value;
                      updateSelection(safeIndex, {
                        facetDisplayName: nextDisplay,
                        facetName: suggestFacetName(nextDisplay, "api-op"),
                      });
                    }}
                    disabled={draftsCreated}
                    maxLength={160}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-slug-${prefix}`}>
                    Facet Name (kebab-case, 4–32 chars)
                  </label>
                  <input
                    id={`draft-slug-${prefix}`}
                    value={activeItem.selection.facetName}
                    onChange={(event) =>
                      updateSelection(safeIndex, {
                        facetName: event.target.value,
                      })
                    }
                    disabled={draftsCreated}
                    pattern={FACET_NAME_PATTERN}
                    minLength={4}
                    maxLength={32}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-category-${prefix}`}>Category</label>
                  <select
                    id={`draft-category-${prefix}`}
                    value={activeItem.selection.category}
                    onChange={(event) =>
                      updateSelection(safeIndex, {
                        category: event.target.value,
                      })
                    }
                    disabled={draftsCreated}
                    required
                  >
                    {getCategoryOptionsWithCurrent(
                      "API",
                      activeItem.selection.category,
                    ).map((option) => (
                      <option key={option.slug} value={option.slug}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-side-effect-${prefix}`}>
                    Side Effects
                  </label>
                  <select
                    id={`draft-side-effect-${prefix}`}
                    value={activeItem.selection.sideEffectClass}
                    onChange={(event) =>
                      updateSelection(safeIndex, {
                        sideEffectClass: event.target
                          .value as DraftSelection["sideEffectClass"],
                      })
                    }
                    disabled={draftsCreated}
                  >
                    {SIDE_EFFECT_CLASSES.map((value) => (
                      <option value={value} key={value}>
                        {value.replaceAll("_", " ")}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field endpoint-url">
                  <label htmlFor={`draft-description-${prefix}`}>
                    When should an agent use this API?
                  </label>
                  <input
                    id={`draft-description-${prefix}`}
                    value={activeItem.selection.description}
                    onChange={(event) =>
                      updateSelection(safeIndex, {
                        description: event.target.value,
                      })
                    }
                    disabled={draftsCreated}
                    placeholder="Get historical Bitcoin prices for short-term analysis"
                  />
                </div>
                <div className="form-field endpoint-url">
                  <label htmlFor={`draft-tags-${prefix}`}>
                    Search Terms (comma-separated)
                  </label>
                  <input
                    id={`draft-tags-${prefix}`}
                    value={activeItem.selection.tags.join(", ")}
                    onChange={(event) =>
                      updateSelection(safeIndex, {
                        tags: event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean),
                      })
                    }
                    disabled={draftsCreated}
                    placeholder="bitcoin, btc, historical prices"
                  />
                </div>
              </div>
            </div>
          ) : null}

          {activeTab === "gateway" ? (
            <div className="rapid-tab-body">
              {!activeItem.draft ? (
                <div className="rapid-lock-banner">
                  <strong>Create drafts first</strong>
                  <p>
                    Click <strong>Create Facet Drafts</strong> in the Endpoints
                    sidebar to unlock upstream Gateway URL and encrypted secret
                    mapping.
                  </p>
                </div>
              ) : null}

              <fieldset
                className="endpoint-fields"
                disabled={
                  !activeItem.draft ||
                  ["VALID", "PUBLISHING", "PUBLISHED"].includes(
                    activeItem.stage,
                  )
                }
              >
                <legend>Upstream Endpoint &amp; Secret Vault</legend>
                <div className="form-field endpoint-url">
                  <label htmlFor={`endpoint-url-${prefix}`}>
                    HTTPS Base URL
                  </label>
                  <input
                    id={`endpoint-url-${prefix}`}
                    type="url"
                    value={activeItem.baseUrl}
                    onChange={(event) =>
                      updateItem(safeIndex, { baseUrl: event.target.value })
                    }
                    placeholder="https://api.provider.example"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`endpoint-auth-${prefix}`}>
                    Upstream Authentication
                  </label>
                  <select
                    id={`endpoint-auth-${prefix}`}
                    value={activeItem.authKind}
                    disabled={activeItem.secretReference !== null}
                    onChange={(event) =>
                      updateItem(safeIndex, {
                        authKind: event.target.value as EndpointAuthKind,
                      })
                    }
                  >
                    <option value="NONE">No API key</option>
                    <option value="API_KEY_HEADER">API key / header</option>
                    <option value="API_KEY_QUERY">API key / query</option>
                    <option value="BEARER">Bearer token</option>
                  </select>
                  {activeItem.authReviewRequired ? (
                    <small className="field-warning">
                      The imported security requirement could not be mapped
                      automatically. Confirm the supported upstream method
                      before saving.
                    </small>
                  ) : null}
                </div>
                {activeItem.authKind.startsWith("API_KEY") ? (
                  <div className="form-field">
                    <label htmlFor={`endpoint-param-${prefix}`}>
                      Parameter Name
                    </label>
                    <input
                      id={`endpoint-param-${prefix}`}
                      value={activeItem.parameterName}
                      onChange={(event) =>
                        updateItem(safeIndex, {
                          parameterName: event.target.value,
                        })
                      }
                      placeholder="X-Api-Key"
                      required
                    />
                  </div>
                ) : null}
                {activeItem.authKind !== "NONE" ? (
                  <>
                    <div className="form-field">
                      <label htmlFor={`secret-label-${prefix}`}>
                        Secret Vault Label
                      </label>
                      <input
                        id={`secret-label-${prefix}`}
                        value={activeItem.secretLabel}
                        disabled={activeItem.secretReference !== null}
                        onChange={(event) =>
                          updateItem(safeIndex, {
                            secretLabel: event.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`secret-value-${prefix}`}>
                        Write-Only Secret Value
                      </label>
                      <input
                        id={`secret-value-${prefix}`}
                        type="password"
                        autoComplete="new-password"
                        value={activeItem.secretValue}
                        disabled={activeItem.secretReference !== null}
                        onChange={(event) =>
                          updateItem(safeIndex, {
                            secretValue: event.target.value,
                          })
                        }
                        required={
                          activeItem.stage === "DRAFT" &&
                          !activeItem.secretReference
                        }
                      />
                      <small>
                        Paste the upstream API key here. FACET stores it
                        write-only and clears this field after saving.
                      </small>
                    </div>
                  </>
                ) : null}
              </fieldset>

              {activeItem.draft ? (
                <div className="draft-actions">
                  {activeItem.stage === "DRAFT" ? (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void configure(safeIndex)}
                    >
                      Save Endpoint Config <span aria-hidden="true">↗</span>
                    </button>
                  ) : activeItem.stage === "CONFIGURING" ? (
                    <span role="status" className="draft-busy">
                      Saving endpoint config…
                    </span>
                  ) : (
                    <span className="draft-ready">
                      ✓ Endpoint configured — proceed to Validate &amp; Publish
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeTab === "publish" ? (
            <div className="rapid-tab-body">
              {!activeItem.draft ? (
                <div className="rapid-lock-banner">
                  <strong>Create drafts &amp; configure endpoint first</strong>
                  <p>
                    Validation and publication unlock once this endpoint&apos;s
                    upstream URL and auth settings are saved.
                  </p>
                </div>
              ) : null}

              {activeItem.validation ? (
                <div className="validation-report" aria-live="polite">
                  <strong>
                    Validation:{" "}
                    {activeItem.validation.validationStatus.toLowerCase()}
                  </strong>
                  {activeItem.validation.errors.length ? (
                    <ul>
                      {activeItem.validation.errors.map((issue) => (
                        <li key={`${issue.code}-${issue.path ?? "root"}`}>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {activeItem.validation.warnings.length ? (
                    <ul>
                      {activeItem.validation.warnings.map((warning) => (
                        <li key={warning.warningId}>
                          {warning.message}
                          {warning.acknowledged ? " — acknowledged" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {activeItem.draft ? (
                <FacetPricingFields
                  idPrefix={`api-${prefix}`}
                  pricingModel="PAY_PER_RUN"
                  priceFusdText="0.001"
                  priceReadOnly={true}
                />
              ) : null}

              {activeItem.draft ? (
                <div className="draft-actions">
                  {activeItem.stage === "DRAFT" ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => setActiveTab("gateway")}
                    >
                      Configure Gateway &amp; Auth First →
                    </button>
                  ) : null}
                  {activeItem.stage === "CONFIGURED" &&
                  !hasUnacknowledgedWarnings ? (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void validate(safeIndex, false)}
                    >
                      Validate Facet <span aria-hidden="true">↗</span>
                    </button>
                  ) : null}
                  {activeItem.stage === "CONFIGURED" &&
                  hasUnacknowledgedWarnings ? (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void validate(safeIndex, true)}
                    >
                      Acknowledge Warnings &amp; Validate{" "}
                      <span aria-hidden="true">↗</span>
                    </button>
                  ) : null}
                  {activeItem.stage === "VALIDATING" ? (
                    <span role="status" className="draft-busy">
                      Validating…
                    </span>
                  ) : null}
                  {activeItem.stage === "VALID" ? (
                    <div className="publish-control">
                      <label htmlFor={`publish-visibility-${prefix}`}>
                        Catalog Visibility
                      </label>
                      <select
                        id={`publish-visibility-${prefix}`}
                        value={activeItem.publicationVisibility}
                        onChange={(event) =>
                          updateItem(safeIndex, {
                            publicationVisibility: event.target.value as
                              "PUBLIC" | "UNLISTED",
                          })
                        }
                      >
                        <option value="PUBLIC">Public</option>
                        <option value="UNLISTED">Unlisted</option>
                      </select>
                      <button
                        className="button button-primary"
                        type="button"
                        onClick={() => void publish(safeIndex)}
                      >
                        Publish Facet <span aria-hidden="true">↗</span>
                      </button>
                    </div>
                  ) : null}
                  {activeItem.stage === "PUBLISHING" ? (
                    <span role="status" className="draft-busy">
                      Publishing…
                    </span>
                  ) : null}
                  {activeItem.stage === "PUBLISHED" &&
                  activeItem.publication ? (
                    <div className="published-banner" role="status">
                      <div>
                        <strong>
                          Published v{activeItem.publication.version} (
                          {activeItem.publication.visibility.toLowerCase()})
                        </strong>
                        <p>{activeItem.publication.contentHash}</p>
                      </div>
                      <Link
                        className="button button-primary"
                        href={`/facets/${encodeURIComponent(activeItem.publication.provider)}/${encodeURIComponent(activeItem.publication.facetName)}`}
                      >
                        Open in Facet Store <span aria-hidden="true">↗</span>
                      </Link>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {activeItem.error ? (
            <div className="error-banner" role="alert">
              <strong>This endpoint needs attention</strong>
              <p>{activeItem.error}</p>
            </div>
          ) : null}
        </div>
      </div>
    </form>
  );
}
