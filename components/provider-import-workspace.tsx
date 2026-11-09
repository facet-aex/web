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
  const [membershipsLoading, setMembershipsLoading] = useState(true);
  const [sourceKind, setSourceKind] = useState<ImportSourceKind>("url");
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

  return (
    <section
      className="provider-console"
      id="provider-console"
      role="region"
      aria-labelledby="provider-console-title"
    >
      <header className="console-heading">
        <div>
          <p className="eyebrow">Phase 1 / Provider flow</p>
          <h2 id="provider-console-title">Provider Console</h2>
        </div>
        <p>
          Import one OpenAPI source, inspect the normalized operations, then
          carry the selection into Facet drafting in the next slice.
        </p>
      </header>

      <div className="console-grid">
        <ol className="console-steps" aria-label="OpenAPI import steps">
          <li data-active="true">
            <span>01</span> Provider
          </li>
          <li data-active={workspace.phase !== "idle"}>
            <span>02</span> Source
          </li>
          <li data-active={workspace.job !== null}>
            <span>03</span> Import
          </li>
          <li data-active={workspace.phase === "ready"}>
            <span>04</span> Operations
          </li>
        </ol>

        <form className="import-form" onSubmit={handleSubmit} noValidate>
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

          <fieldset className="source-switcher" disabled={isBusy}>
            <legend>OpenAPI source</legend>
            {(
              [
                [
                  "url",
                  "HTTPS URL",
                  "Fetched by FACET's isolated HTTPS fetcher.",
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
            <label htmlFor="import-name">Source name</label>
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
                Selection is a local preview only. Facet creation begins in
                Slice 3.
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
    </section>
  );
}
