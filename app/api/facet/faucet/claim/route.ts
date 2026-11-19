import {
  isRequestBodyLimitError,
  readBoundedRequestBody,
  requestTooLargeResponse,
} from "@/lib/control-api-server";

function faucetUnavailableResponse(): Response {
  return Response.json(
    {
      error: {
        code: "CONTROL_API_UNAVAILABLE",
        message: "Faucet backend service is temporarily unavailable.",
      },
    },
    { status: 503 },
  );
}

export async function POST(request: Request): Promise<Response> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) {
    return faucetUnavailableResponse();
  }

  let body: string;
  try {
    body = await readBoundedRequestBody(request, 16 * 1024);
  } catch (error) {
    if (isRequestBodyLimitError(error)) {
      return requestTooLargeResponse("Faucet claim");
    }
    throw error;
  }

  const headers = new Headers({
    accept: "application/json",
    "content-type": "application/json",
  });
  for (const headerName of ["x-forwarded-for", "x-real-ip", "x-request-id"]) {
    const value = request.headers.get(headerName);
    if (value) headers.set(headerName, value);
  }

  try {
    const upstream = await fetch(new URL("/v1/faucet/claim", baseUrl), {
      method: "POST",
      headers,
      body,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(60_000),
    });
    const text = await upstream.text();
    return new Response(text, {
      status: upstream.status,
      headers: { "content-type": "application/json; charset=utf-8" },
    });
  } catch {
    return faucetUnavailableResponse();
  }
}
