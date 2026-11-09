const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

export interface ControlApiProxyInit {
  method?: "GET" | "POST";
  body?: string;
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
