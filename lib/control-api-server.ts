import { verifyToken } from "@clerk/backend";

import {
  isValidFacetName,
  isValidSemver,
  isValidUsername,
} from "@/lib/identifiers";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const MAX_IMPORT_COMMAND_BYTES = 2 * 5 * 1024 * 1024 + 64 * 1024;

export interface ControlApiProxyInit {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: string;
  forwardIdempotencyKey?: boolean;
}

class RequestBodyLimitError extends Error {
  readonly code = "IMPORT_TOO_LARGE";
}

export function validateJobId(value: string): boolean {
  return uuidPattern.test(value);
}

export const validateUsername = isValidUsername;
export const validateFacetName = isValidFacetName;
export const validateSemver = isValidSemver;

export function invalidResourceIdResponse(resource: string): Response {
  return Response.json(
    {
      error: {
        code: "INPUT_INVALID",
        message: `The ${resource} identifier is invalid.`,
      },
    },
    { status: 400 },
  );
}

export function invalidJobIdResponse(): Response {
  return Response.json(
    {
      error: {
        code: "INPUT_INVALID",
        message: "The import job identifier is invalid.",
      },
    },
    { status: 400 },
  );
}

export function importTooLargeResponse(): Response {
  return Response.json(
    {
      error: {
        code: "IMPORT_TOO_LARGE",
        message: "The OpenAPI import command exceeds the transport limit.",
      },
    },
    { status: 413 },
  );
}

export function requestTooLargeResponse(resource: string): Response {
  return Response.json(
    {
      error: {
        code: "REQUEST_TOO_LARGE",
        message: `The ${resource} request is too large.`,
      },
    },
    { status: 413 },
  );
}

export async function readBoundedRequestBody(
  request: Request,
  maxBytes = MAX_IMPORT_COMMAND_BYTES,
): Promise<string> {
  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > maxBytes) {
      throw new RequestBodyLimitError();
    }
  }

  if (!request.body) return "";

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw new RequestBodyLimitError();
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(body);
}

export function isRequestBodyLimitError(
  error: unknown,
): error is { code: "IMPORT_TOO_LARGE" } {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "IMPORT_TOO_LARGE"
  );
}

function unavailableResponse(): Response {
  return Response.json(
    {
      error: {
        code: "CONTROL_API_UNAVAILABLE",
        message: "The FACET Control API is unavailable.",
      },
    },
    { status: 502 },
  );
}

function unauthorizedResponse(
  message = "Authentication is required.",
): Response {
  return Response.json(
    {
      error: {
        code: "AUTHENTICATION_REQUIRED",
        message,
      },
    },
    { status: 401 },
  );
}

function readCookieToken(
  cookieHeader: string | null,
  name: string,
): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const key = part.slice(0, idx).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return undefined;
}

function extractClerkToken(request: Request): string | undefined {
  const authHeader = request.headers.get("authorization");
  const bearer = /^Bearer\s+(.+)$/iu.exec(authHeader ?? "");
  if (bearer?.[1]) return bearer[1];
  return readCookieToken(request.headers.get("cookie"), "__session");
}

export async function proxyControlApi(
  request: Request,
  path: string,
  init: ControlApiProxyInit = {},
): Promise<Response> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) return unavailableResponse();

  const headers = new Headers({
    accept: "application/json",
  });
  if (init.body !== undefined) {
    headers.set("content-type", "application/json");
  }

  const requestId = request.headers.get("x-request-id");
  if (requestId) headers.set("x-request-id", requestId);
  if (init.forwardIdempotencyKey) {
    const key = request.headers.get("idempotency-key");
    if (key && key.length <= 128) headers.set("idempotency-key", key);
  }

  const authMode =
    process.env.FACET_AUTH_MODE ??
    (process.env.FACET_ENV === "local" ? "local" : "clerk");

  if (authMode === "local") {
    if (process.env.FACET_ENV !== "local") return unavailableResponse();
    const devUser = process.env.FACET_LOCAL_DEV_USER;
    if (!devUser) return unavailableResponse();
    headers.set("x-facet-dev-user", devUser);
  } else {
    const token = extractClerkToken(request);
    if (!token) {
      return unauthorizedResponse(
        "Sign in with Clerk to access Provider Console.",
      );
    }
    const secretKey = process.env.CLERK_SECRET_KEY;
    const jwtKey = process.env.CLERK_JWT_KEY;
    if (!secretKey && !jwtKey) {
      return unavailableResponse();
    }
    try {
      const authorizedParties = (
        process.env.CLERK_AUTHORIZED_PARTIES ??
        process.env.PUBLIC_WEB_ORIGIN ??
        "http://localhost:3000"
      )
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      const verified = await verifyToken(token, {
        ...(secretKey ? { secretKey } : {}),
        ...(jwtKey ? { jwtKey } : {}),
        ...(process.env.CLERK_JWT_ISSUER
          ? { issuer: process.env.CLERK_JWT_ISSUER }
          : {}),
        authorizedParties,
      });
      if (!verified.sub) {
        return unauthorizedResponse("Invalid Clerk session token.");
      }
      headers.set("authorization", `Bearer ${token}`);
    } catch {
      return unauthorizedResponse("Invalid or expired Clerk session.");
    }
  }

  try {
    const upstream = await fetch(new URL(path, baseUrl), {
      method: init.method ?? "GET",
      headers,
      ...(init.body !== undefined ? { body: init.body } : {}),
      cache: "no-store",
      redirect: "error",
    });
    const body = await upstream.text();

    return new Response(body, {
      status: upstream.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return unavailableResponse();
  }
}
