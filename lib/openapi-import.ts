export const MAX_OPENAPI_UPLOAD_BYTES = 5 * 1024 * 1024;

export type ImportSourceKind = "url" | "paste" | "upload";

export type ImportStatus =
  | "queued"
  | "fetching"
  | "parsing"
  | "normalizing"
  | "ready"
  | "failed"
  | "expired";

export interface ImportJob {
  id: string;
  providerId: string;
  apiSourceId: string;
  sourceVersionId: string | null;
  status: ImportStatus;
  warnings: unknown;
  errorCode: string | null;
  errorSummary: string | null;
  createdAt: string;
}

export interface OperationCandidate {
  id: string;
  jsonPointer: string;
  operationId: string | null;
  method: string;
  path: string;
  summary: string | null;
  normalizedCandidate: unknown;
  warnings: unknown;
}

export type ImportWorkspaceState =
  | { phase: "idle"; job: null; error: null }
  | { phase: "submitting"; job: null; error: null }
  | { phase: "polling"; job: ImportJob; error: null }
  | { phase: "ready"; job: ImportJob; error: null }
  | { phase: "failed"; job: ImportJob | null; error: string };

interface CreateImportInput {
  providerId: string;
  name: string;
  sourceKind: ImportSourceKind;
  sourceValue: string;
  mediaType?: string;
}

export type CreateImportRequest = {
  providerId: string;
  name: string;
  source:
    | { kind: "url"; url: string }
    | {
        kind: "paste" | "upload";
        content: string;
        mediaType?: string;
      };
};

export function isTerminalImportStatus(status: ImportStatus): boolean {
  return status === "ready" || status === "failed" || status === "expired";
}

export function toImportRequest(input: CreateImportInput): CreateImportRequest {
  if (input.sourceKind === "url") {
    return {
      providerId: input.providerId,
      name: input.name,
      source: { kind: "url", url: input.sourceValue },
    };
  }

  return {
    providerId: input.providerId,
    name: input.name,
    source: {
      kind: input.sourceKind,
      content: input.sourceValue,
      ...(input.mediaType ? { mediaType: input.mediaType } : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function readErrorEnvelope(value: unknown): string {
  if (isRecord(value) && isRecord(value.error)) {
    const message = value.error.message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return "The request could not be completed.";
}

export function readWarningMessages(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value.flatMap((warning) => {
    if (typeof warning === "string" && warning.trim()) {
      return [warning.trim()];
    }
    if (isRecord(warning)) {
      const message = warning.message;
      if (typeof message === "string" && message.trim()) {
        return [message.trim()];
      }
    }
    return [];
  });
}
