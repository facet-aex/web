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

export async function GET(): Promise<Response> {
  const baseUrl = process.env.FACET_CONTROL_API_URL;
  if (!baseUrl) {
    return faucetUnavailableResponse();
  }

  try {
    const upstream = await fetch(new URL("/v1/faucet/status", baseUrl), {
      method: "GET",
      headers: { accept: "application/json" },
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(5_000),
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
