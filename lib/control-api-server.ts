const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
export const MAX_IMPORT_COMMAND_BYTES = 2 * 5 * 1024 * 1024 + 64 * 1024;

export interface ControlApiProxyInit {
  method?: "GET" | "POST";
  body?: string;
}

class RequestBodyLimitError extends Error {
  readonly code = "IMPORT_TOO_LARGE";
}

export function validateJobId(value: string): boolean {
  return uuidPattern.test(value);
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

  if (process.env.FACET_ENV === "local") {
    const devUser = process.env.FACET_LOCAL_DEV_USER;
    if (!devUser) return unavailableResponse();
    headers.set("x-facet-dev-user", devUser);
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
