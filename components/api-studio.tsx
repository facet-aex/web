"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import { FacetDraftWorkbench } from "@/components/facet-draft-workbench";
import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import { makeManualOpenApi } from "@/lib/manual-openapi";
import {
  readErrorEnvelope,
  readWarningMessages,
  toImportRequest,
  type ImportJob,
  type ImportSourceKind,
  type ImportWorkspaceState,
  type OperationCandidate,
} from "@/lib/openapi-import";
import {
  pollImportJob,
  readImportJobResponse,
  validateOpenApiUpload,
} from "@/lib/openapi-import-client";
import { useProviderWorkspace } from "@/lib/use-provider-workspace";

type EntryMode = "openapi" | "quick";

const initialWorkspaceState: ImportWorkspaceState = {
  phase: "idle",
  job: null,
  error: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readOperations(value: unknown): OperationCandidate[] {
  if (!isRecord(value) || !Array.isArray(value.operations)) return [];

  return value.operations.flatMap((candidate) => {
    if (
      !isRecord(candidate) ||
      typeof candidate.id !== "string" ||
      typeof candidate.jsonPointer !== "string" ||
      typeof candidate.method !== "string" ||
      typeof candidate.path !== "string"
    ) {
      return [];
    }
    return [
      {
        id: candidate.id,
        jsonPointer: candidate.jsonPointer,
        operationId:
          typeof candidate.operationId === "string"
            ? candidate.operationId
            : null,
        method: candidate.method,
        path: candidate.path,
        summary:
          typeof candidate.summary === "string" ? candidate.summary : null,
        normalizedCandidate: candidate.normalizedCandidate,
        warnings: candidate.warnings,
      },
    ];
  });
}

async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => null);
}

function jobFailureMessage(job: ImportJob): string {
  if (job.errorSummary) return job.errorSummary;
  if (job.status === "expired") return "This import job expired.";
  return `Import failed${job.errorCode ? ` (${job.errorCode})` : ""}.`;
}

function extractPathParams(endpointUrl: string): string[] {
  try {
    const url = new URL(endpointUrl.trim());
    return [...decodeURI(url.pathname).matchAll(/\{([A-Za-z0-9_]+)\}/gu)].map(
      (match) => match[1]!,
    );
  } catch {
    return [];
  }
}

export function ApiStudio({
  publishableKey,
}: {
  publishableKey?: string | undefined;
}) {
  const providerWorkspace = useProviderWorkspace();
  const [resolvedProviderId, setResolvedProviderId] = useState("");
  const providerId = resolvedProviderId || providerWorkspace.providerId;

  const [entryMode, setEntryMode] = useState<EntryMode>("openapi");
  const [sourceKind, setSourceKind] = useState<ImportSourceKind>("url");

  // Quick GET Endpoint state (RapidAPI-style form)
  const [quickTitle, setQuickTitle] = useState("");
  const [quickEndpoint, setQuickEndpoint] = useState("");
  const [quickSummary, setQuickSummary] = useState("");
  const [quickQueryParams, setQuickQueryParams] = useState<string[]>([""]);
  const [quickKeyHeader, setQuickKeyHeader] = useState("");

  // OpenAPI Import state
  const [sourceName, setSourceName] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [pastedContent, setPastedContent] = useState("");
  const [uploadContent, setUploadContent] = useState("");
  const [uploadMediaType, setUploadMediaType] = useState("");
  const [uploadName, setUploadName] = useState("");

  const [workspace, setWorkspace] = useState<ImportWorkspaceState>(
    initialWorkspaceState,
  );
  const [operations, setOperations] = useState<OperationCandidate[]>([]);
  const [selectedOperations, setSelectedOperations] = useState<Set<string>>(
    new Set(),
  );
  const [selectionLocked, setSelectionLocked] = useState(false);
  const [anyPublished, setAnyPublished] = useState(false);
  const importAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      importAbort.current?.abort();
    };
  }, []);

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    setUploadContent("");
    setUploadName("");
    if (!file) return;

    const validationError = validateOpenApiUpload(file);
    if (validationError) {
      event.target.value = "";
      setWorkspace({ phase: "failed", job: null, error: validationError });
      return;
    }

    try {
      const content = await file.text();
      setUploadContent(content);
      setUploadName(file.name);
      setUploadMediaType(file.type || "application/yaml");
      setWorkspace(initialWorkspaceState);
    } catch {
      setWorkspace({
        phase: "failed",
        job: null,
        error: "The selected file could not be read as UTF-8 text.",
      });
    }
  }

  function validateOpenApiForm(): string | null {
    if (!sourceName.trim()) return "Enter an API description name.";
    if (sourceKind === "url") {
      try {
        if (new URL(sourceUrl).protocol !== "https:") {
          return "Enter an HTTPS OpenAPI URL.";
        }
      } catch {
        return "Enter a valid HTTPS OpenAPI URL.";
      }
    }
    if (sourceKind === "paste" && !pastedContent.trim()) {
      return "Paste an OpenAPI document.";
    }
    if (sourceKind === "upload" && !uploadContent) {
      return "Choose a JSON or YAML text file.";
    }
    return null;
  }

  async function loadOperations(
    job: ImportJob,
    signal: AbortSignal,
    autoSelectSingle: boolean,
  ) {
    const response = await fetch(
      `/api/facet/openapi-imports/${job.id}/operations`,
      { cache: "no-store", signal },
    );
    const body = await readJson(response);
    if (!response.ok) throw new Error(readErrorEnvelope(body));
    const loaded = readOperations(body);
    setOperations(loaded);
    if (autoSelectSingle && loaded.length > 0) {
      setSelectedOperations(new Set(loaded.map((op) => op.id)));
    }
  }

  async function runImportPipeline(params: {
    name: string;
    kind: ImportSourceKind;
    value: string;
    mediaType?: string;
    autoSelect: boolean;
  }) {
    importAbort.current?.abort();
    const controller = new AbortController();
    importAbort.current = controller;
    setOperations([]);
    setSelectedOperations(new Set());
    setSelectionLocked(false);
    setAnyPublished(false);
    setWorkspace({ phase: "submitting", job: null, error: null });

    try {
      const targetProviderId =
        providerId ||
        (await (async () => {
          const ensured = await providerWorkspace.ensureProvider();
          if (!ensured.providerId) {
            throw new Error(
              ensured.authRequired
                ? "Sign in with Clerk to import and publish APIs under your account."
                : (ensured.error ??
                    "Your provider workspace could not be initialized."),
            );
          }
          setResolvedProviderId(ensured.providerId);
          return ensured.providerId;
        })());

      const request = toImportRequest({
        providerId: targetProviderId,
        name: params.name,
        sourceKind: params.kind,
        sourceValue: params.value,
        ...(params.mediaType ? { mediaType: params.mediaType } : {}),
      });

      const response = await fetch("/api/facet/openapi-imports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
        signal: controller.signal,
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(readErrorEnvelope(body));

      const createdJob = readImportJobResponse(body);
      if (!createdJob) {
        throw new Error("The Control API returned an invalid import job.");
      }
      setWorkspace({
        phase: "polling",
        job: createdJob,
        error: null,
      });

      const job = await pollImportJob(createdJob.id, {
        signal: controller.signal,
        onUpdate: (updated) =>
          setWorkspace({ phase: "polling", job: updated, error: null }),
      });
      if (job.status !== "ready") {
        setWorkspace({
          phase: "failed",
          job,
          error: jobFailureMessage(job),
        });
        return;
      }

      await loadOperations(job, controller.signal, params.autoSelect);
      setWorkspace({ phase: "ready", job, error: null });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setWorkspace((current) => ({
        phase: "failed",
        job: current.job,
        error:
          error instanceof Error
            ? error.message
            : "The import could not be completed.",
      }));
    }
  }

  async function handleOpenApiSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateOpenApiForm();
    if (validationError) {
      setWorkspace({ phase: "failed", job: null, error: validationError });
      return;
    }

    const sourceValue =
      sourceKind === "url"
        ? sourceUrl.trim()
        : sourceKind === "paste"
          ? pastedContent
          : uploadContent;

    await runImportPipeline({
      name: sourceName.trim(),
      kind: sourceKind,
      value: sourceValue,
      ...(sourceKind === "upload" && uploadMediaType
        ? { mediaType: uploadMediaType }
        : sourceKind === "paste"
          ? { mediaType: "application/yaml" }
          : {}),
      autoSelect: false,
    });
  }

  async function handleQuickEndpointSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const queryNames = quickQueryParams
      .map((param) => param.trim())
      .filter(Boolean)
      .join(", ");
    try {
      const openApiDoc = makeManualOpenApi({
        title: quickTitle,
        endpointUrl: quickEndpoint,
        summary: quickSummary,
        queryNames,
        apiKeyHeader: quickKeyHeader,
      });
      await runImportPipeline({
        name: quickTitle.trim(),
        kind: "paste",
        value: openApiDoc,
        mediaType: "application/json",
        autoSelect: true,
      });
    } catch (error) {
      setWorkspace({
        phase: "failed",
        job: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not generate an API definition.",
      });
    }
  }

  function toggleOperation(operationId: string) {
    if (selectionLocked) return;
    setSelectedOperations((current) => {
      const next = new Set(current);
      if (next.has(operationId)) next.delete(operationId);
      else next.add(operationId);
      return next;
    });
  }

  const isBusy =
    workspace.phase === "submitting" || workspace.phase === "polling";
  const jobWarnings = workspace.job
    ? readWarningMessages(workspace.job.warnings)
    : [];
  const selectedOperationCandidates = operations.filter((operation) =>
    selectedOperations.has(operation.id),
  );
  const detectedPathParams = extractPathParams(quickEndpoint);

  return (
    <section
      className="api-studio"
      id="provider-console"
      role="region"
      aria-labelledby="api-studio-title"
    >
      <header className="studio-mode-header">
        <div>
          <div className="modality-pill-row">
            <span className="badge-type badge-modality-api">⇄ FACET · API</span>
            <span className="studio-mode-tag">
              RapidAPI-Style Console · Gateway Proxy
            </span>
          </div>
          <h1 id="api-studio-title">API Studio</h1>
          <p>
            Onboard any REST service via OpenAPI 3.0/3.1 or describe a single
            GET endpoint, configure upstream security, and publish it as a Facet
            to Store.
          </p>
        </div>
        <div
          className="studio-tabs"
          role="tablist"
          aria-label="API definition mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "openapi"}
            className={`tab-button ${entryMode === "openapi" ? "tab-active" : ""}`}
            onClick={() => setEntryMode("openapi")}
          >
            Import OpenAPI Spec
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={entryMode === "quick"}
            className={`tab-button ${entryMode === "quick" ? "tab-active" : ""}`}
            onClick={() => setEntryMode("quick")}
          >
            Quick Endpoint (GET)
          </button>
        </div>
      </header>

      <ProviderSelectorBar
        workspace={providerWorkspace}
        publishableKey={publishableKey}
      />

      <ol className="rapid-stage-bar" aria-label="API onboarding pipeline">
        <li data-active="true">
          <span>01</span> Define or Import
        </li>
        <li data-active={workspace.phase === "ready"}>
          <span>02</span> Select Operations
        </li>
        <li data-active={selectionLocked}>
          <span>03</span> Configure Gateway &amp; Auth
        </li>
        <li data-active={anyPublished}>
          <span>04</span> Validate &amp; Publish
        </li>
      </ol>

      <div className="rapid-source-grid">
        {entryMode === "openapi" ? (
          <form
            className="import-form"
            onSubmit={handleOpenApiSubmit}
            noValidate
          >
            <fieldset className="source-switcher" disabled={isBusy}>
              <legend>OpenAPI 3.0 / 3.1 Source</legend>
              {(
                [
                  [
                    "url",
                    "HTTPS URL",
                    "URL of an OpenAPI JSON/YAML document fetched by the isolated importer.",
                  ],
                  ["paste", "Paste", "Paste bounded OpenAPI JSON or YAML."],
                  [
                    "upload",
                    "Upload",
                    "Local JSON-content fallback (<= 5 MiB). Multipart upload is not implemented.",
                  ],
                ] as const
              ).map(([value, label, desc]) => (
                <label className="source-option" key={value}>
                  <input
                    type="radio"
                    name="source-kind"
                    value={value}
                    checked={sourceKind === value}
                    onChange={() => setSourceKind(value)}
                  />
                  <span>
                    <strong>{label}</strong>
                    <small>{desc}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            <div className="form-field">
              <label htmlFor="import-name">API Name</label>
              <input
                id="import-name"
                value={sourceName}
                onChange={(event) => setSourceName(event.target.value)}
                placeholder="e.g. CoinGecko Market API"
                maxLength={160}
                disabled={isBusy}
                required
              />
            </div>

            {sourceKind === "url" ? (
              <div className="form-field">
                <label htmlFor="import-url">OpenAPI HTTPS URL</label>
                <input
                  id="import-url"
                  type="url"
                  value={sourceUrl}
                  onChange={(event) => setSourceUrl(event.target.value)}
                  placeholder="https://provider.example/openapi.json"
                  disabled={isBusy}
                  required
                />
              </div>
            ) : null}

            {sourceKind === "paste" ? (
              <div className="form-field">
                <label htmlFor="import-paste">OpenAPI JSON or YAML</label>
                <textarea
                  id="import-paste"
                  value={pastedContent}
                  onChange={(event) => setPastedContent(event.target.value)}
                  rows={10}
                  spellCheck={false}
                  disabled={isBusy}
                  required
                />
              </div>
            ) : null}

            {sourceKind === "upload" ? (
              <div className="form-field">
                <label htmlFor="import-upload">OpenAPI File</label>
                <input
                  id="import-upload"
                  type="file"
                  accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
                  onChange={handleUpload}
                  disabled={isBusy}
                  required
                />
                <small>
                  Reads a maximum 5 MiB UTF-8 text file in the browser and sends
                  the JSON-content fallback.
                </small>
                {uploadName ? (
                  <span className="file-name">{uploadName}</span>
                ) : null}
              </div>
            ) : null}

            {workspace.error ? (
              <div className="error-banner" role="alert">
                <strong>Import needs attention</strong>
                <p>{workspace.error}</p>
              </div>
            ) : null}

            <button
              className="button button-primary import-submit"
              type="submit"
              disabled={isBusy || providerWorkspace.authRequired}
            >
              {workspace.phase === "submitting"
                ? "Queueing Import…"
                : workspace.phase === "polling"
                  ? "Parsing OpenAPI Spec…"
                  : "Import OpenAPI Spec"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
        ) : (
          <form
            className="import-form"
            onSubmit={handleQuickEndpointSubmit}
            noValidate
          >
            <div className="quick-endpoint-banner">
              <span className="operation-method">GET</span>
              <p>
                Describe one REST GET JSON endpoint. FACET compiles OpenAPI 3.1
                and queues the import automatically.
              </p>
            </div>

            <div className="form-field">
              <label htmlFor="quick-title">API Name</label>
              <input
                id="quick-title"
                value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)}
                placeholder="Bitcoin Price History"
                disabled={isBusy}
                required
              />
            </div>

            <div className="form-field">
              <label htmlFor="quick-endpoint">HTTPS Endpoint URL</label>
              <input
                id="quick-endpoint"
                type="url"
                value={quickEndpoint}
                onChange={(e) => setQuickEndpoint(e.target.value)}
                placeholder="https://api.coingecko.com/api/v3/coins/{id}/market_chart"
                disabled={isBusy}
                required
              />
              {detectedPathParams.length > 0 ? (
                <div className="detected-params">
                  <span>Detected path parameters:</span>
                  {detectedPathParams.map((param) => (
                    <code key={param}>{`{${param}}`}</code>
                  ))}
                </div>
              ) : (
                <small>
                  Wrap dynamic path variables in braces like{" "}
                  <code>{`{id}`}</code>.
                </small>
              )}
            </div>

            <div className="form-field">
              <label htmlFor="quick-summary">
                What can an agent do with this endpoint?
              </label>
              <input
                id="quick-summary"
                value={quickSummary}
                onChange={(e) => setQuickSummary(e.target.value)}
                placeholder="Fetch historical crypto price series for market analysis"
                disabled={isBusy}
                required
              />
            </div>

            <div className="quick-params-builder">
              <div className="quick-params-header">
                <span>Required Query Parameters</span>
                <button
                  type="button"
                  className="preset-chip"
                  disabled={isBusy}
                  onClick={() => setQuickQueryParams((prev) => [...prev, ""])}
                >
                  + Add Query Param
                </button>
              </div>
              {quickQueryParams.map((param, idx) => (
                <div className="quick-param-row" key={`qp-${idx}`}>
                  <input
                    aria-label={`Query parameter ${idx + 1}`}
                    value={param}
                    disabled={isBusy}
                    onChange={(e) =>
                      setQuickQueryParams((prev) =>
                        prev.map((item, itemIdx) =>
                          itemIdx === idx ? e.target.value : item,
                        ),
                      )
                    }
                    placeholder={idx === 0 ? "vs_currency" : "days"}
                  />
                  {quickQueryParams.length > 1 ? (
                    <button
                      type="button"
                      className="preset-chip danger-chip"
                      disabled={isBusy}
                      onClick={() =>
                        setQuickQueryParams((prev) =>
                          prev.filter((_, itemIdx) => itemIdx !== idx),
                        )
                      }
                    >
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            <div className="form-field">
              <label htmlFor="quick-key-header">
                API Key Header Name (optional)
              </label>
              <input
                id="quick-key-header"
                value={quickKeyHeader}
                onChange={(e) => setQuickKeyHeader(e.target.value)}
                placeholder="x-cg-demo-api-key"
                disabled={isBusy}
              />
            </div>

            {workspace.error ? (
              <div className="error-banner" role="alert">
                <strong>Endpoint build needs attention</strong>
                <p>{workspace.error}</p>
              </div>
            ) : null}

            <button
              className="button button-primary import-submit"
              type="submit"
              disabled={isBusy || providerWorkspace.authRequired}
            >
              {isBusy
                ? "Building & Importing…"
                : "Build Spec & Import Endpoint"}
              <span aria-hidden="true">↗</span>
            </button>
          </form>
        )}

        <aside className="import-status" aria-labelledby="import-status-title">
          <div className="status-heading">
            <p className="eyebrow">Live Importer</p>
            <h2 id="import-status-title">Operations &amp; Status</h2>
          </div>

          <div className="status-live" role="status" aria-live="polite">
            <span className={`job-state job-state-${workspace.phase}`}>
              {workspace.phase}
            </span>
            <p>
              {workspace.job
                ? `Job ${workspace.job.id} is ${workspace.job.status}.`
                : providerWorkspace.authRequired
                  ? "Sign in with Clerk to import endpoints."
                  : "Ready for an OpenAPI source or quick GET endpoint."}
            </p>
          </div>

          {jobWarnings.length ? (
            <div className="job-warnings">
              <h3>Import Warnings</h3>
              <ul>
                {jobWarnings.map((warning, index) => (
                  <li key={`${warning}-${index}`}>{warning}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {workspace.phase === "ready" ? (
            <div className="operation-preview">
              <div className="operation-heading">
                <h3>Discovered Operations</h3>
                <span>
                  {selectedOperations.size}/{operations.length} selected
                </span>
              </div>
              {operations.length > 1 && !selectionLocked ? (
                <div className="operation-bulk-actions">
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() =>
                      setSelectedOperations(
                        new Set(operations.map((o) => o.id)),
                      )
                    }
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    className="preset-chip"
                    onClick={() => setSelectedOperations(new Set())}
                  >
                    Clear
                  </button>
                </div>
              ) : null}
              <p className="operation-note">
                Select one or more operations to configure in the RapidAPI
                Definition Hub below. Selection locks after draft creation.
              </p>
              {operations.length ? (
                <ul>
                  {operations.map((operation) => {
                    const warnings = readWarningMessages(operation.warnings);
                    return (
                      <li key={operation.id}>
                        <label>
                          <input
                            type="checkbox"
                            checked={selectedOperations.has(operation.id)}
                            onChange={() => toggleOperation(operation.id)}
                            disabled={selectionLocked}
                          />
                          <span className="operation-method">
                            {operation.method.toUpperCase()}
                          </span>
                          <span className="operation-copy">
                            <strong>{operation.path}</strong>
                            <small>
                              {operation.summary ??
                                operation.operationId ??
                                "No operation summary"}
                            </small>
                            {warnings.map((warning) => (
                              <em key={warning}>Warning: {warning}</em>
                            ))}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>No operations were returned by this document.</p>
              )}
            </div>
          ) : null}
        </aside>
      </div>

      {workspace.phase === "ready" &&
      workspace.job &&
      selectedOperationCandidates.length ? (
        <FacetDraftWorkbench
          key={selectedOperationCandidates
            .map((operation) => operation.id)
            .join(":")}
          providerId={providerId}
          importJobId={workspace.job.id}
          operations={selectedOperationCandidates}
          onDraftsCreated={() => setSelectionLocked(true)}
          onAnyPublished={() => setAnyPublished(true)}
        />
      ) : null}
    </section>
  );
}
