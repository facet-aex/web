import { suggestFacetName } from "@/lib/identifiers";
import type { OperationCandidate } from "@/lib/openapi-import";

export const SIDE_EFFECT_CLASSES = [
  "READ_ONLY",
  "IDEMPOTENT_WRITE",
  "NON_IDEMPOTENT_WRITE",
  "UNKNOWN",
] as const;

export type SideEffectClass = (typeof SIDE_EFFECT_CLASSES)[number];
export type EndpointAuthKind =
  "NONE" | "API_KEY_HEADER" | "API_KEY_QUERY" | "BEARER";

export interface DraftSelection {
  operationCandidateId: string;
  facetName: string;
  facetDisplayName: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  sideEffectClass: SideEffectClass;
}

export interface FacetDraft {
  provider: string;
  facetName: string;
  facetDisplayName: string;
  draftVersion: {
    version: string;
    revision: number;
  };
}

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationWarning extends ValidationIssue {
  warningId: string;
  acknowledged: boolean;
}

export interface FacetValidationResult {
  provider: string;
  facetName: string;
  version: string;
  status: "DRAFT" | "VALID";
  revision: number;
  validationStatus: "INVALID" | "VALID";
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
}

export interface FacetPublicationResult {
  provider: string;
  facetName: string;
  facetDisplayName: string;
  version: string;
  visibility: "UNLISTED" | "PUBLIC";
  contentHash: string;
  publishedAt: string;
  revision: number;
}

export interface EndpointSuggestion {
  baseUrl: string;
  authKind: EndpointAuthKind;
  parameterName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function defaultName(operation: OperationCandidate): string {
  return (
    operation.summary?.trim() ||
    operation.operationId?.trim() ||
    `${operation.method.toUpperCase()} ${operation.path}`
  );
}

export function buildDraftSelections(
  operations: OperationCandidate[],
): DraftSelection[] {
  return operations.map((operation) => {
    const display = defaultName(operation);
    return {
      operationCandidateId: operation.id,
      facetName: suggestFacetName(
        operation.operationId?.trim() || display,
        "api-op",
      ),
      facetDisplayName: display,
      summary: operation.summary?.trim() || display,
      description: operation.summary?.trim() || display,
      category: "api",
      tags: [],
      sideEffectClass:
        operation.method.toUpperCase() === "GET" ? "READ_ONLY" : "UNKNOWN",
    };
  });
}

function normalizedOperation(
  operation: OperationCandidate,
): Record<string, unknown> | null {
  const candidate = operation.normalizedCandidate;
  if (!isRecord(candidate) || !isRecord(candidate.normalized)) return null;
  return candidate.normalized;
}

function concreteServerUrl(value: unknown): string {
  if (!isRecord(value) || typeof value.url !== "string") return "";
  const variables = isRecord(value.variables) ? value.variables : {};
  return value.url.replace(/\{([^{}]+)\}/g, (_match, name: string) => {
    const variable = variables[name];
    if (typeof variable === "string") return variable;
    if (isRecord(variable) && typeof variable.default === "string") {
      return variable.default;
    }
    return `{${name}}`;
  });
}

export function suggestEndpoint(
  operation: OperationCandidate,
): EndpointSuggestion {
  const normalized = normalizedOperation(operation);
  const servers =
    normalized && Array.isArray(normalized.servers) ? normalized.servers : [];
  const baseUrl = concreteServerUrl(servers[0]);
  const alternatives =
    normalized && Array.isArray(normalized.authAlternatives)
      ? normalized.authAlternatives
      : [];

  if (alternatives.length === 0) return { baseUrl, authKind: "NONE" };
  if (
    alternatives.some(
      (alternative) =>
        isRecord(alternative) &&
        Array.isArray(alternative.schemes) &&
        alternative.schemes.length === 0,
    )
  ) {
    return { baseUrl, authKind: "NONE" };
  }

  if (alternatives.length !== 1) return { baseUrl, authKind: "NONE" };
  const onlyAlternative = alternatives[0];
  if (!isRecord(onlyAlternative) || !Array.isArray(onlyAlternative.schemes)) {
    return { baseUrl, authKind: "NONE" };
  }
  if (onlyAlternative.schemes.length !== 1) {
    return { baseUrl, authKind: "NONE" };
  }
  const scheme = onlyAlternative.schemes[0];
  if (!isRecord(scheme)) return { baseUrl, authKind: "NONE" };
  const kind = scheme.kind;
  if (
    kind !== "API_KEY_HEADER" &&
    kind !== "API_KEY_QUERY" &&
    kind !== "BEARER"
  ) {
    return { baseUrl, authKind: "NONE" };
  }
  const parameterName =
    typeof scheme.parameterName === "string" && scheme.parameterName.trim()
      ? scheme.parameterName.trim()
      : undefined;
  return {
    baseUrl,
    authKind: kind,
    ...(parameterName ? { parameterName } : {}),
  };
}

export function requiresManualAuthReview(
  operation: OperationCandidate,
): boolean {
  const normalized = normalizedOperation(operation);
  const alternatives =
    normalized && Array.isArray(normalized.authAlternatives)
      ? normalized.authAlternatives
      : [];
  if (alternatives.length === 0) return false;
  if (
    alternatives.some(
      (alternative) =>
        isRecord(alternative) &&
        Array.isArray(alternative.schemes) &&
        alternative.schemes.length === 0,
    )
  ) {
    return false;
  }
  if (alternatives.length !== 1) return true;
  const alternative = alternatives[0];
  if (!isRecord(alternative) || !Array.isArray(alternative.schemes)) {
    return true;
  }
  if (alternative.schemes.length !== 1) return true;
  const scheme = alternative.schemes[0];
  return !(
    isRecord(scheme) &&
    (scheme.kind === "API_KEY_HEADER" ||
      scheme.kind === "API_KEY_QUERY" ||
      scheme.kind === "BEARER")
  );
}

function isDraft(value: unknown): value is FacetDraft {
  if (!isRecord(value) || !isRecord(value.draftVersion)) return false;
  const draftVersion = value.draftVersion;
  return (
    typeof value.provider === "string" &&
    typeof value.facetName === "string" &&
    typeof value.facetDisplayName === "string" &&
    typeof draftVersion.version === "string" &&
    typeof draftVersion.revision === "number"
  );
}

export function readFacetDraftsResponse(value: unknown): FacetDraft[] | null {
  if (!isRecord(value) || !Array.isArray(value.facets)) return null;
  return value.facets.every(isDraft) ? value.facets : null;
}

function readIssue(value: unknown): ValidationIssue | null {
  if (
    !isRecord(value) ||
    typeof value.code !== "string" ||
    typeof value.message !== "string"
  ) {
    return null;
  }
  return {
    code: value.code,
    message: value.message,
    ...(typeof value.path === "string" ? { path: value.path } : {}),
  };
}

function readWarning(value: unknown): ValidationWarning | null {
  const issue = readIssue(value);
  if (
    !issue ||
    !isRecord(value) ||
    typeof value.warningId !== "string" ||
    typeof value.acknowledged !== "boolean"
  ) {
    return null;
  }
  return {
    ...issue,
    warningId: value.warningId,
    acknowledged: value.acknowledged,
  };
}

export function readFacetValidationResponse(
  value: unknown,
): FacetValidationResult | null {
  if (!isRecord(value) || !isRecord(value.facetVersion)) return null;
  const version = value.facetVersion;
  if (
    typeof version.provider !== "string" ||
    typeof version.facetName !== "string" ||
    typeof version.version !== "string" ||
    (version.status !== "DRAFT" && version.status !== "VALID") ||
    typeof version.revision !== "number" ||
    !isRecord(version.validation) ||
    (version.validation.status !== "INVALID" &&
      version.validation.status !== "VALID") ||
    !Array.isArray(version.validation.errors) ||
    !Array.isArray(version.validation.warnings)
  ) {
    return null;
  }
  const errors = version.validation.errors.map(readIssue);
  const warnings = version.validation.warnings.map(readWarning);
  if (
    errors.some((issue) => issue === null) ||
    warnings.some((item) => item === null)
  ) {
    return null;
  }
  return {
    provider: version.provider,
    facetName: version.facetName,
    version: version.version,
    status: version.status,
    revision: version.revision,
    validationStatus: version.validation.status,
    errors: errors as ValidationIssue[],
    warnings: warnings as ValidationWarning[],
  };
}

export function readFacetPublicationResponse(
  value: unknown,
): FacetPublicationResult | null {
  if (
    !isRecord(value) ||
    !isRecord(value.facet) ||
    !isRecord(value.facetVersion)
  ) {
    return null;
  }
  const facet = value.facet;
  const version = value.facetVersion;
  if (
    typeof facet.provider !== "string" ||
    typeof facet.facetName !== "string" ||
    typeof facet.facetDisplayName !== "string" ||
    facet.status !== "PUBLISHED" ||
    (facet.visibility !== "UNLISTED" && facet.visibility !== "PUBLIC") ||
    typeof facet.currentPublishedVersion !== "string" ||
    typeof facet.revision !== "number" ||
    version.provider !== facet.provider ||
    version.facetName !== facet.facetName ||
    typeof version.version !== "string" ||
    version.version !== facet.currentPublishedVersion ||
    version.status !== "PUBLISHED" ||
    version.visibility !== facet.visibility ||
    typeof version.contentHash !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(version.contentHash) ||
    typeof version.publishedAt !== "string" ||
    typeof version.revision !== "number"
  ) {
    return null;
  }
  return {
    provider: facet.provider,
    facetName: facet.facetName,
    facetDisplayName: facet.facetDisplayName,
    version: version.version,
    visibility: facet.visibility,
    contentHash: version.contentHash,
    publishedAt: version.publishedAt,
    revision: version.revision,
  };
}
