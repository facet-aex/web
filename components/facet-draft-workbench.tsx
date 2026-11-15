"use client";

import { useState, type FormEvent } from "react";

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
import {
  readErrorEnvelope,
  type OperationCandidate,
} from "@/lib/openapi-import";

interface FacetDraftWorkbenchProps {
  providerId: string;
  importJobId: string;
  operations: OperationCandidate[];
  onDraftsCreated?: () => void;
}

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
  version: number | null;
  validation: FacetValidationResult | null;
  publication: FacetPublicationResult | null;
  publicationVisibility: "PUBLIC" | "UNLISTED";
  stage:
    | "EDITING"
    | "DRAFT"
    | "CONFIGURING"
    | "CONFIGURED"
    | "VALIDATING"
    | "VALID"
    | "PUBLISHING"
    | "PUBLISHED";
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
      secretLabel: `${selections[index]!.name} upstream credential`,
      secretValue: "",
      secretReference: null,
      authReviewRequired: requiresManualAuthReview(operation),
      draft: null,
      version: null,
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

function readConfiguredVersion(value: unknown): number | null {
  if (!isRecord(value) || !isRecord(value.endpointConfig)) return null;
  const version = value.endpointConfig.facetVersionVersion;
  return typeof version === "number" ? version : null;
}

export function FacetDraftWorkbench({
  providerId,
  importJobId,
  operations,
  onDraftsCreated,
}: FacetDraftWorkbenchProps) {
  const [items, setItems] = useState<WorkbenchItem[]>(() =>
    createItems(operations),
  );
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

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
          providerId,
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
          version: drafts[index]!.draftVersion.version,
          stage: "DRAFT",
          error: null,
        })),
      );
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
    if (!item?.draft || item.version === null) return;
    updateItem(index, { stage: "CONFIGURING", error: null });

    try {
      let secretRefId = item.secretReference ?? undefined;
      if (item.authKind !== "NONE") {
        if (!secretRefId && !item.secretValue)
          throw new Error("Enter the upstream secret value.");
        if (!secretRefId) {
          const secretResponse = await fetch(
            `/api/facet/providers/${encodeURIComponent(providerId)}/secrets`,
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
        `/api/facet/facet-versions/${encodeURIComponent(item.draft.draftVersion.id)}/endpoint-config`,
        {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: item.version,
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
      const nextVersion = readConfiguredVersion(configBody);
      if (nextVersion === null) {
        throw new Error("The Control API returned invalid endpoint metadata.");
      }
      updateItem(index, {
        version: nextVersion,
        stage: "CONFIGURED",
        error: null,
      });
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
    if (!item?.draft || item.version === null) return;
    updateItem(index, { stage: "VALIDATING", error: null });

    try {
      const warningAcknowledgements = acknowledgeWarnings
        ? (item.validation?.warnings ?? []).map((warning) => ({
            warningId: warning.warningId,
            reason: "Provider reviewed this warning in the FACET console.",
          }))
        : [];
      const response = await fetch(
        `/api/facet/facet-versions/${encodeURIComponent(item.draft.draftVersion.id)}/validate`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: item.version,
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
        version: validation.version,
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
    if (!item?.draft || item.version === null || item.stage !== "VALID") return;
    updateItem(index, { stage: "PUBLISHING", error: null });

    try {
      const response = await fetch(
        `/api/facet/facet-versions/${encodeURIComponent(item.draft.draftVersion.id)}/publish`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            version: item.version,
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
        version: publication.version,
        stage: "PUBLISHED",
        error: null,
      });
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

  return (
    <form className="draft-workbench" onSubmit={createDrafts}>
      <header className="draft-workbench-heading">
        <div>
          <p className="eyebrow">Draft workbench</p>
          <h3>Draft selected operations</h3>
        </div>
        <p>
          FACET generated one agent tool contract per selected operation. Give
          it a clear name and description so agents can find it. Then confirm
          the private API endpoint and optional key, validate, and publish.
        </p>
      </header>

      <ol className="draft-progress" aria-label="Facet draft progress">
        <li data-complete="true">Import</li>
        <li data-complete={draftsCreated}>Draft</li>
        <li
          data-complete={items.every((item) =>
            ["VALID", "PUBLISHING", "PUBLISHED"].includes(item.stage),
          )}
        >
          Valid
        </li>
      </ol>

      <div className="draft-list">
        {items.map((item, index) => {
          const prefix = `facet-${item.operation.id}`;
          const hasUnacknowledgedWarnings =
            item.validation?.warnings.some(
              (warning) => !warning.acknowledged,
            ) ?? false;
          return (
            <section className="draft-row" key={item.operation.id}>
              <header className="draft-row-heading">
                <span className="operation-method">
                  {item.operation.method.toUpperCase()}
                </span>
                <div>
                  <h4>{item.operation.path}</h4>
                  <p>{item.operation.summary ?? item.operation.operationId}</p>
                </div>
                <span
                  className={`draft-stage draft-stage-${item.stage.toLowerCase()}`}
                >
                  {item.stage}
                </span>
              </header>

              <div className="draft-fields">
                <div className="form-field">
                  <label htmlFor={`draft-name-${prefix}`}>Facet name</label>
                  <input
                    id={`draft-name-${prefix}`}
                    value={item.selection.name}
                    onChange={(event) =>
                      updateSelection(index, { name: event.target.value })
                    }
                    disabled={draftsCreated}
                    maxLength={160}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-slug-${prefix}`}>Slug</label>
                  <input
                    id={`draft-slug-${prefix}`}
                    value={item.selection.slug}
                    onChange={(event) =>
                      updateSelection(index, { slug: event.target.value })
                    }
                    disabled={draftsCreated}
                    pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-category-${prefix}`}>Category</label>
                  <input
                    id={`draft-category-${prefix}`}
                    value={item.selection.category}
                    onChange={(event) =>
                      updateSelection(index, { category: event.target.value })
                    }
                    disabled={draftsCreated}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-description-${prefix}`}>
                    When should an agent use this?
                  </label>
                  <input
                    id={`draft-description-${prefix}`}
                    value={item.selection.description}
                    onChange={(event) =>
                      updateSelection(index, {
                        description: event.target.value,
                      })
                    }
                    disabled={draftsCreated}
                    placeholder="Get historical Bitcoin prices for short-term analysis"
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`draft-tags-${prefix}`}>
                    Search terms (comma-separated)
                  </label>
                  <input
                    id={`draft-tags-${prefix}`}
                    value={item.selection.tags.join(", ")}
                    onChange={(event) =>
                      updateSelection(index, {
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
                <div className="form-field">
                  <label htmlFor={`draft-side-effect-${prefix}`}>
                    Side effects
                  </label>
                  <select
                    id={`draft-side-effect-${prefix}`}
                    value={item.selection.sideEffectClass}
                    onChange={(event) =>
                      updateSelection(index, {
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
              </div>

              <fieldset
                className="endpoint-fields"
                disabled={
                  !item.draft ||
                  ["VALID", "PUBLISHING", "PUBLISHED"].includes(item.stage)
                }
              >
                <legend>Where FACET calls your API</legend>
                <div className="form-field endpoint-url">
                  <label htmlFor={`endpoint-url-${prefix}`}>
                    HTTPS base URL
                  </label>
                  <input
                    id={`endpoint-url-${prefix}`}
                    type="url"
                    value={item.baseUrl}
                    onChange={(event) =>
                      updateItem(index, { baseUrl: event.target.value })
                    }
                    placeholder="https://api.provider.example"
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor={`endpoint-auth-${prefix}`}>
                    Authentication
                  </label>
                  <select
                    id={`endpoint-auth-${prefix}`}
                    value={item.authKind}
                    disabled={item.secretReference !== null}
                    onChange={(event) =>
                      updateItem(index, {
                        authKind: event.target.value as EndpointAuthKind,
                      })
                    }
                  >
                    <option value="NONE">No API key</option>
                    <option value="API_KEY_HEADER">API key / header</option>
                    <option value="API_KEY_QUERY">API key / query</option>
                    <option value="BEARER">Bearer token</option>
                  </select>
                  {item.authReviewRequired ? (
                    <small className="field-warning">
                      The imported security requirement could not be mapped
                      automatically. Confirm the supported upstream method
                      before saving.
                    </small>
                  ) : null}
                </div>
                {item.authKind.startsWith("API_KEY") ? (
                  <div className="form-field">
                    <label htmlFor={`endpoint-param-${prefix}`}>
                      Parameter name
                    </label>
                    <input
                      id={`endpoint-param-${prefix}`}
                      value={item.parameterName}
                      onChange={(event) =>
                        updateItem(index, { parameterName: event.target.value })
                      }
                      placeholder="X-Api-Key"
                      required
                    />
                  </div>
                ) : null}
                {item.authKind !== "NONE" ? (
                  <>
                    <div className="form-field">
                      <label htmlFor={`secret-label-${prefix}`}>
                        Secret label
                      </label>
                      <input
                        id={`secret-label-${prefix}`}
                        value={item.secretLabel}
                        disabled={item.secretReference !== null}
                        onChange={(event) =>
                          updateItem(index, { secretLabel: event.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`secret-value-${prefix}`}>
                        Secret value
                      </label>
                      <input
                        id={`secret-value-${prefix}`}
                        type="password"
                        autoComplete="new-password"
                        value={item.secretValue}
                        disabled={item.secretReference !== null}
                        onChange={(event) =>
                          updateItem(index, { secretValue: event.target.value })
                        }
                        required={
                          item.stage === "DRAFT" && !item.secretReference
                        }
                      />
                      <small>
                        Paste the provider API key here. FACET stores it
                        privately and clears this field after saving.
                      </small>
                    </div>
                  </>
                ) : null}
              </fieldset>

              {item.error ? (
                <div className="error-banner" role="alert">
                  <strong>This Facet needs attention</strong>
                  <p>{item.error}</p>
                </div>
              ) : null}

              {item.validation ? (
                <div className="validation-report" aria-live="polite">
                  <strong>
                    Validation: {item.validation.validationStatus.toLowerCase()}
                  </strong>
                  {item.validation.errors.length ? (
                    <ul>
                      {item.validation.errors.map((issue) => (
                        <li key={`${issue.code}-${issue.path ?? "root"}`}>
                          {issue.message}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {item.validation.warnings.length ? (
                    <ul>
                      {item.validation.warnings.map((warning) => (
                        <li key={warning.warningId}>
                          {warning.message}
                          {warning.acknowledged ? " — acknowledged" : ""}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}

              {item.draft ? (
                <div className="draft-actions">
                  {item.stage === "DRAFT" ? (
                    <button
                      className="button button-secondary"
                      type="button"
                      onClick={() => void configure(index)}
                    >
                      Save endpoint
                    </button>
                  ) : null}
                  {item.stage === "CONFIGURED" && !hasUnacknowledgedWarnings ? (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void validate(index, false)}
                    >
                      Validate Facet
                    </button>
                  ) : null}
                  {item.stage === "CONFIGURED" && hasUnacknowledgedWarnings ? (
                    <button
                      className="button button-primary"
                      type="button"
                      onClick={() => void validate(index, true)}
                    >
                      Acknowledge warnings and validate
                    </button>
                  ) : null}
                  {item.stage === "CONFIGURING" ||
                  item.stage === "VALIDATING" ? (
                    <span role="status" className="draft-busy">
                      {item.stage === "CONFIGURING" ? "Saving…" : "Validating…"}
                    </span>
                  ) : null}
                  {item.stage === "VALID" ? (
                    <div className="publish-control">
                      <label htmlFor={`publish-visibility-${prefix}`}>
                        Catalog visibility
                      </label>
                      <select
                        id={`publish-visibility-${prefix}`}
                        value={item.publicationVisibility}
                        onChange={(event) =>
                          updateItem(index, {
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
                        onClick={() => void publish(index)}
                      >
                        Publish Facet
                      </button>
                    </div>
                  ) : null}
                  {item.stage === "PUBLISHING" ? (
                    <span role="status" className="draft-busy">
                      Publishing…
                    </span>
                  ) : null}
                  {item.stage === "PUBLISHED" && item.publication ? (
                    <span className="draft-ready">
                      Published {item.publication.displayVersion} /{" "}
                      {item.publication.visibility.toLowerCase()}
                    </span>
                  ) : null}
                </div>
              ) : null}
            </section>
          );
        })}
      </div>

      {!draftsCreated ? (
        <div className="draft-create-bar">
          <p>
            {items.length} operation{items.length === 1 ? "" : "s"} selected
          </p>
          <button
            className="button button-primary"
            type="submit"
            disabled={creating || !items.length}
          >
            {creating ? "Creating drafts…" : "Create Facet drafts"}
          </button>
        </div>
      ) : null}
      {createError ? (
        <div className="error-banner" role="alert">
          <strong>Draft creation needs attention</strong>
          <p>{createError}</p>
        </div>
      ) : null}
    </form>
  );
}
