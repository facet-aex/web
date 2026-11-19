import {
  MAX_OPENAPI_UPLOAD_BYTES,
  isTerminalImportStatus,
  readErrorEnvelope,
  type ImportJob,
  type ImportStatus,
} from "@/lib/openapi-import";

const importStatuses = new Set<ImportStatus>([
  "queued",
  "fetching",
  "parsing",
  "normalizing",
  "ready",
  "failed",
  "expired",
]);

interface PollImportOptions {
  fetcher?: typeof fetch;
  wait?: (signal?: AbortSignal) => Promise<void>;
  onUpdate?: (job: ImportJob) => void;
  maxAttempts?: number;
  signal?: AbortSignal;
}

interface UploadDescriptor {
  name: string;
  size: number;
  type: string;
}

function abortError(): DOMException {
  return new DOMException("The import request was cancelled.", "AbortError");
}

async function waitForNextPoll(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) throw abortError();

  await new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(resolve, 750);
    signal?.addEventListener(
      "abort",
      () => {
        window.clearTimeout(timeout);
        reject(abortError());
      },
      { once: true },
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readImportJobResponse(value: unknown): ImportJob | null {
  if (!isRecord(value) || !isRecord(value.job)) return null;
  const job = value.job;
  if (
    typeof job.id !== "string" ||
    typeof job.apiSourceId !== "string" ||
    typeof job.status !== "string" ||
    !importStatuses.has(job.status as ImportStatus) ||
    typeof job.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: job.id,
    apiSourceId: job.apiSourceId,
    sourceVersionId:
      typeof job.sourceVersionId === "string" ? job.sourceVersionId : null,
    status: job.status as ImportStatus,
    warnings: job.warnings,
    errorCode: typeof job.errorCode === "string" ? job.errorCode : null,
    errorSummary:
      typeof job.errorSummary === "string" ? job.errorSummary : null,
    createdAt: job.createdAt,
  };
}

export async function pollImportJob(
  jobId: string,
  options: PollImportOptions = {},
): Promise<ImportJob> {
  const fetcher = options.fetcher ?? fetch;
  const wait = options.wait ?? waitForNextPoll;
  const maxAttempts = options.maxAttempts ?? 80;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (options.signal?.aborted) throw abortError();

    const response = await fetcher(`/api/facet/openapi-imports/${jobId}`, {
      cache: "no-store",
      signal: options.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) throw new Error(readErrorEnvelope(body));

    const job = readImportJobResponse(body);
    if (!job)
      throw new Error("The Control API returned an invalid import job.");

    options.onUpdate?.(job);
    if (isTerminalImportStatus(job.status)) return job;
    if (attempt === maxAttempts - 1) break;
    await wait(options.signal);
  }

  throw new Error(
    "Import polling timed out. The server job may still be running.",
  );
}

export function validateOpenApiUpload(file: UploadDescriptor): string | null {
  if (file.size > MAX_OPENAPI_UPLOAD_BYTES) {
    return "Choose a file no larger than 5 MiB.";
  }

  const extensionAccepted = /\.(?:json|ya?ml)$/iu.test(file.name);
  const mediaTypeAccepted =
    file.type === "application/json" ||
    file.type === "application/yaml" ||
    file.type === "application/x-yaml" ||
    file.type === "text/yaml" ||
    file.type === "text/x-yaml" ||
    file.type.startsWith("text/");

  if (!extensionAccepted && !mediaTypeAccepted) {
    return "Choose a JSON or YAML text file.";
  }
  return null;
}
