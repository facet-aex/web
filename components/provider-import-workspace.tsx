"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  pollImportJob,
  readImportJobResponse,
  validateOpenApiUpload,
} from "@/lib/openapi-import-client";
import {
  readErrorEnvelope,
  readWarningMessages,
  toImportRequest,
  type ImportJob,
  type ImportSourceKind,
  type ImportWorkspaceState,
  type OperationCandidate,
} from "@/lib/openapi-import";
import { FacetDraftWorkbench } from "@/components/facet-draft-workbench";
import { makeManualOpenApi } from "@/lib/manual-openapi";

interface ProviderMembership {
  provider: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
}

const initialWorkspaceState: ImportWorkspaceState = {
  phase: "idle",
  job: null,
  error: null,
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readMemberships(value: unknown): ProviderMembership[] {
  if (!isRecord(value) || !Array.isArray(value.memberships)) return [];

  return value.memberships.flatMap((membership) => {
    if (!isRecord(membership) || !isRecord(membership.provider)) return [];
    const provider = membership.provider;
    if (
      typeof provider.id !== "string" ||
      typeof provider.name !== "string" ||
      typeof provider.slug !== "string" ||
      typeof membership.role !== "string"
    ) {
      return [];
    }
    return [
      {
        provider: {
          id: provider.id,
          name: provider.name,
          slug: provider.slug,
        },
        role: membership.role,
      },
    ];
  });
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

export function ProviderImportWorkspace() {
  const [memberships, setMemberships] = useState<ProviderMembership[]>([]);
  const [providerId, setProviderId] = useState("");
  const [newProviderName, setNewProviderName] = useState("");
  const [newProviderSlug, setNewProviderSlug] = useState("");
  const [providerCreating, setProviderCreating] = useState(false);
  const [providerError, setProviderError] = useState<string | null>(null);
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [sourceKind, setSourceKind] = useState<ImportSourceKind>("url");
  const [showManual, setShowManual] = useState(false);
  const [manualTitle, setManualTitle] = useState("");
  const [manualEndpoint, setManualEndpoint] = useState("");
  const [manualSummary, setManualSummary] = useState("");
  const [manualQuery, setManualQuery] = useState("");
  const [manualKeyHeader, setManualKeyHeader] = useState("");
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
  const importAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch("/api/facet/providers", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = await readJson(response);
        if (!response.ok) throw new Error(readErrorEnvelope(body));

        const nextMemberships = readMemberships(body);
        setMemberships(nextMemberships);
        setProviderId(nextMemberships[0]?.provider.id ?? "");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setWorkspace({
          phase: "failed",
          job: null,
          error:
            error instanceof Error
              ? error.message
              : "Provider memberships could not be loaded.",
        });
      } finally {
        if (!controller.signal.aborted) setMembershipsLoading(false);
      }
    })();

    return () => {
      controller.abort();
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

  function validateForm(): string | null {
    if (!providerId) return "Choose a provider before importing.";
    if (!sourceName.trim()) return "Enter a source name.";
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

  async function loadOperations(job: ImportJob, signal: AbortSignal) {
    const response = await fetch(
      `/api/facet/openapi-imports/${job.id}/operations`,
      { cache: "no-store", signal },
    );
    const body = await readJson(response);
    if (!response.ok) throw new Error(readErrorEnvelope(body));
    setOperations(readOperations(body));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setWorkspace({ phase: "failed", job: null, error: validationError });
      return;
    }

    importAbort.current?.abort();
    const controller = new AbortController();
    importAbort.current = controller;
    setOperations([]);
    setSelectedOperations(new Set());
    setSelectionLocked(false);
    setWorkspace({ phase: "submitting", job: null, error: null });

    const sourceValue =
      sourceKind === "url"
        ? sourceUrl.trim()
        : sourceKind === "paste"
          ? pastedContent
          : uploadContent;
    const request = toImportRequest({
      providerId,
      name: sourceName.trim(),
      sourceKind,
      sourceValue,
      ...(sourceKind === "upload" && uploadMediaType
        ? { mediaType: uploadMediaType }
        : sourceKind === "paste"
          ? { mediaType: "application/yaml" }
          : {}),
    });

    try {
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

      await loadOperations(job, controller.signal);
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

  function toggleOperation(operationId: string) {
    if (selectionLocked) return;
    setSelectedOperations((current) => {
      const next = new Set(current);
      if (next.has(operationId)) next.delete(operationId);
      else next.add(operationId);
      return next;
    });
  }

  function generateManualSource() {
    try {
      const content = makeManualOpenApi({
        title: manualTitle,
        endpointUrl: manualEndpoint,
        summary: manualSummary,
        queryNames: manualQuery,
        apiKeyHeader: manualKeyHeader,
      });
      setSourceKind("paste");
      setSourceName(manualTitle.trim());
      setPastedContent(content);
      setWorkspace(initialWorkspaceState);
    } catch (error) {
      setWorkspace({
        phase: "failed",
        job: null,
        error:
          error instanceof Error
            ? error.message
            : "Could not create an API description.",
      });
    }
  }

  async function createProvider() {
    setProviderCreating(true);
    setProviderError(null);
    try {
      const response = await fetch("/api/facet/providers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: newProviderName.trim(),
          slug: newProviderSlug.trim(),
        }),
      });
      const body = await readJson(response);
      if (!response.ok) throw new Error(readErrorEnvelope(body));
      if (
        !isRecord(body) ||
        !isRecord(body.provider) ||
        typeof body.provider.id !== "string" ||
        typeof body.provider.name !== "string" ||
        typeof body.provider.slug !== "string"
      )
        throw new Error("The Control API returned invalid provider details.");
      const created = {
        provider: {
          id: body.provider.id,
          name: body.provider.name,
          slug: body.provider.slug,
        },
        role: "owner",
      };
      setMemberships((current) => [...current, created]);
      setProviderId(created.provider.id);
      setNewProviderName("");
      setNewProviderSlug("");
    } catch (error) {
      setProviderError(
        error instanceof Error ? error.message : "Could not create provider.",
      );
    } finally {
      setProviderCreating(false);
    }
  }

  const isBusy =
    workspace.phase === "submitting" || workspace.phase === "polling";
  const jobWarnings = workspace.job
    ? readWarningMessages(workspace.job.warnings)
    : [];
  const selectedOperationCandidates = operations.filter((operation) =>
    selectedOperations.has(operation.id),
  );

  return (
    <section
      className="provider-console"
      id="provider-console"
      role="region"
      aria-labelledby="provider-console-title"
    >
      <header className="console-heading">
        <div>
          <p className="eyebrow">Publish an API / local demo</p>
          <h2 id="provider-console-title">Provider Console</h2>
        </div>
        <p>
          Bring an OpenAPI document or describe one GET endpoint. FACET turns
          each selected API operation into an agent-ready Facet; you review its
          name, inputs and access before publishing.
        </p>
      </header>

      <div className="console-grid">
        <ol className="console-steps" aria-label="OpenAPI import steps">
          <li data-active="true">
            <span>01</span> Your provider
          </li>
          <li data-active={workspace.phase !== "idle"}>
            <span>02</span> Describe API
          </li>
          <li data-active={workspace.job !== null}>
            <span>03</span> Read API
          </li>
          <li data-active={workspace.phase === "ready"}>
            <span>04</span> Choose operations
          </li>
          <li data-active={selectionLocked}>
            <span>05</span> Publish
          </li>
        </ol>

        <form className="import-form" onSubmit={handleSubmit} noValidate>
          <div className="provider-intro">
            <strong>What you need</strong>
            <p>
              1. An OpenAPI URL/file, or a GET endpoint URL. 2. An API key only
              if your API requires one. 3. A short description of what the
              endpoint does. FACET generates the tool contract from this
              information.
            </p>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setShowManual((current) => !current)}
              aria-expanded={showManual}
            >
              {showManual
                ? "Hide endpoint form"
                : "I only have an API endpoint"}
            </button>
          </div>
          {showManual ? (
            <fieldset className="endpoint-fields manual-api-fields">
              <legend>Describe one GET endpoint</legend>
              <div className="form-field">
                <label htmlFor="manual-title">API name</label>
                <input
                  id="manual-title"
                  value={manualTitle}
                  onChange={(event) => setManualTitle(event.target.value)}
                  placeholder="Bitcoin price history"
                />
              </div>
              <div className="form-field">
                <label htmlFor="manual-endpoint">HTTPS endpoint URL</label>
                <input
                  id="manual-endpoint"
                  type="url"
                  value={manualEndpoint}
                  onChange={(event) => setManualEndpoint(event.target.value)}
                  placeholder="https://api.coingecko.com/api/v3/coins/{id}/market_chart"
                />
              </div>
              <div className="form-field">
                <label htmlFor="manual-summary">
                  What can an agent do with this API?
                </label>
                <input
                  id="manual-summary"
                  value={manualSummary}
                  onChange={(event) => setManualSummary(event.target.value)}
                  placeholder="Get historical cryptocurrency prices for short-term analysis"
                />
              </div>
              <div className="form-field">
                <label htmlFor="manual-query">
                  Required query parameters (comma-separated)
                </label>
                <input
                  id="manual-query"
                  value={manualQuery}
                  onChange={(event) => setManualQuery(event.target.value)}
                  placeholder="vs_currency, days"
                />
              </div>
              <div className="form-field">
                <label htmlFor="manual-key-header">
                  API key header name (optional)
                </label>
                <input
                  id="manual-key-header"
                  value={manualKeyHeader}
                  onChange={(event) => setManualKeyHeader(event.target.value)}
                  placeholder="x-cg-demo-api-key"
                />
              </div>
              <button
                type="button"
                className="button button-secondary"
                onClick={generateManualSource}
              >
                Create API description
              </button>
              <small>
                FACET prepares the OpenAPI description. Review it below, then
                import, select the operation, add the key if needed, validate
                and publish.
              </small>
            </fieldset>
          ) : null}
          <div className="form-field">
            <label htmlFor="import-provider">Provider</label>
            <select
              id="import-provider"
              value={providerId}
              onChange={(event) => setProviderId(event.target.value)}
              disabled={membershipsLoading || isBusy}
              required
            >
              <option value="">
                {membershipsLoading
                  ? "Loading providers…"
                  : memberships.length
                    ? "Choose provider"
                    : "No provider memberships"}
              </option>
              {memberships.map((membership) => (
                <option
                  key={membership.provider.id}
                  value={membership.provider.id}
                >
                  {membership.provider.name} / {membership.role}
                </option>
              ))}
            </select>
          </div>
          <fieldset className="endpoint-fields provider-create-fields">
            <legend>New provider? Create your profile</legend>
            <div className="form-field">
              <label htmlFor="new-provider-name">Provider name</label>
              <input
                id="new-provider-name"
                value={newProviderName}
                onChange={(event) => setNewProviderName(event.target.value)}
                placeholder="My data service"
                maxLength={120}
              />
            </div>
            <div className="form-field">
              <label htmlFor="new-provider-slug">Public handle</label>
              <input
                id="new-provider-slug"
                value={newProviderSlug}
                onChange={(event) => setNewProviderSlug(event.target.value)}
                placeholder="my-data-service"
                pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                maxLength={63}
              />
            </div>
            <button
              type="button"
              className="button button-secondary"
              disabled={
                providerCreating ||
                !newProviderName.trim() ||
                !newProviderSlug.trim()
              }
              onClick={() => void createProvider()}
            >
              {providerCreating ? "Creating provider…" : "Create provider"}
            </button>
            {providerError ? <p role="alert">{providerError}</p> : null}
          </fieldset>

          <fieldset className="source-switcher" disabled={isBusy}>
            <legend>OpenAPI source</legend>
            {(
              [
                [
                  "url",
                  "HTTPS URL",
                  "URL of an OpenAPI JSON/YAML document, not the API endpoint itself.",
                ],
                ["paste", "Paste", "Paste bounded OpenAPI JSON or YAML."],
                [
                  "upload",
                  "Upload",
                  "Local JSON-content fallback. Multipart upload is not implemented.",
                ],
              ] as const
            ).map(([value, label, description]) => (
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
                  <small>{description}</small>
                </span>
              </label>
            ))}
          </fieldset>

          <div className="form-field">
            <label htmlFor="import-name">API description name</label>
            <input
              id="import-name"
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              placeholder="e.g. CoinGecko Demo API"
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
                rows={12}
                spellCheck={false}
                disabled={isBusy}
                required
              />
            </div>
          ) : null}

          {sourceKind === "upload" ? (
            <div className="form-field">
              <label htmlFor="import-upload">OpenAPI file</label>
              <input
                id="import-upload"
                type="file"
                accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml"
                onChange={handleUpload}
                disabled={isBusy}
                required
              />
              <small>
                The local demo reads a maximum 5 MiB UTF-8 text file in the
                browser and sends the current JSON-content fallback.
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
            disabled={membershipsLoading || !providerId || isBusy}
          >
            {workspace.phase === "submitting"
              ? "Queueing…"
              : workspace.phase === "polling"
                ? "Importing…"
                : "Import OpenAPI"}
            <span aria-hidden="true">↗</span>
          </button>
        </form>

        <aside className="import-status" aria-labelledby="import-status-title">
          <div className="status-heading">
            <p className="eyebrow">Live job</p>
            <h3 id="import-status-title">Import status</h3>
          </div>
          <div className="status-live" role="status" aria-live="polite">
            <span className={`job-state job-state-${workspace.phase}`}>
              {workspace.phase}
            </span>
            <p>
              {workspace.job
                ? `Job ${workspace.job.id} is ${workspace.job.status}.`
                : membershipsLoading
                  ? "Loading provider memberships."
                  : "Ready for a source."}
            </p>
          </div>

          {jobWarnings.length ? (
            <div className="job-warnings">
              <h4>Import warnings</h4>
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
                <h4>Operation candidates</h4>
                <span>
                  {selectedOperations.size}/{operations.length} selected
                </span>
              </div>
              <p className="operation-note">
                Each selected operation becomes one independently configured
                Facet. Selection locks after the draft batch is created.
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
        />
      ) : null}
    </section>
  );
}
