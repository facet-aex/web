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
  slug: string;
  name: string;
  summary: string;
  description: string;
  category: string;
  tags: string[];
  sideEffectClass: SideEffectClass;
}

export interface FacetDraft {
  id: string;
  slug: string;
  draftVersion: {
    id: string;
    version: number;
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
  id: string;
  status: "DRAFT" | "VALID";
  version: number;
  validationStatus: "INVALID" | "VALID";
  errors: ValidationIssue[];
  warnings: ValidationWarning[];
}

export interface FacetPublicationResult {
  facetId: string;
  versionId: string;
  visibility: "UNLISTED" | "PUBLIC";
  displayVersion: string;
  contentHash: string;
  publishedAt: string;
  version: number;
}

export interface EndpointSuggestion {
  baseUrl: string;
  authKind: EndpointAuthKind;
  parameterName?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) && value.every((item) => typeof item === "string")
  );
}

function defaultName(operation: OperationCandidate): string {
  return (
    operation.summary?.trim() ||
    operation.operationId?.trim() ||
    `${operation.method.toUpperCase()} ${operation.path}`
  );
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 63);
  return slug || "api-operation";
}

export function buildDraftSelections(
  operations: OperationCandidate[],
): DraftSelection[] {
  return operations.map((operation) => {
    const name = defaultName(operation);
    return {
      operationCandidateId: operation.id,
      slug: slugify(operation.operationId?.trim() || name),
      name,
      summary: operation.summary?.trim() || name,
      description: operation.summary?.trim() || name,
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
  const version = value.draftVersion;
  return (
    typeof value.id === "string" &&
    typeof value.slug === "string" &&
    typeof version.id === "string" &&
    typeof version.version === "number"
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
    typeof version.id !== "string" ||
    (version.status !== "DRAFT" && version.status !== "VALID") ||
    typeof version.version !== "number" ||
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
    id: version.id,
    status: version.status,
    version: version.version,
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
    typeof facet.id !== "string" ||
    facet.status !== "PUBLISHED" ||
    (facet.visibility !== "UNLISTED" && facet.visibility !== "PUBLIC") ||
    typeof facet.currentPublishedVersionId !== "string" ||
    typeof facet.version !== "number" ||
    typeof version.id !== "string" ||
    typeof version.facetId !== "string" ||
    version.facetId !== facet.id ||
    version.id !== facet.currentPublishedVersionId ||
    typeof version.displayVersion !== "string" ||
    version.status !== "PUBLISHED" ||
    version.visibility !== facet.visibility ||
    typeof version.contentHash !== "string" ||
    !/^sha256:[a-f0-9]{64}$/u.test(version.contentHash) ||
    typeof version.publishedAt !== "string" ||
    typeof version.version !== "number"
  ) {
    return null;
  }
  return {
    facetId: facet.id,
    versionId: version.id,
    visibility: facet.visibility,
    displayVersion: version.displayVersion,
    contentHash: version.contentHash,
    publishedAt: version.publishedAt,
    version: version.version,
  };
}
