export interface ManualApiInput {
  title: string;
  endpointUrl: string;
  summary: string;
  queryNames: string;
  apiKeyHeader: string;
}

export function makeManualOpenApi(input: ManualApiInput): string {
  const url = new URL(input.endpointUrl.trim());
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "Enter an HTTPS endpoint URL without credentials or a query string.",
    );
  const path = decodeURI(url.pathname);
  const pathNames = [...path.matchAll(/\{([A-Za-z0-9_]+)\}/gu)].map(
    (match) => match[1]!,
  );
  if (
    pathNames.length !== new Set(pathNames).size ||
    !input.title.trim() ||
    !input.summary.trim()
  )
    throw new Error(
      "Enter a title, a clear tool description, and unique path placeholders.",
    );
  const queryNames = input.queryNames
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);
  if (
    queryNames.some((name) => !/^[A-Za-z0-9_]+$/u.test(name)) ||
    queryNames.length !== new Set(queryNames).size
  )
    throw new Error(
      "Use unique comma-separated query parameter names, such as vs_currency, days.",
    );
  const header = input.apiKeyHeader.trim();
  if (header && !/^[A-Za-z0-9-]+$/u.test(header))
    throw new Error("The API key header name is invalid.");
  const parameters = [
    ...pathNames.map((name) => ({
      name,
      in: "path",
      required: true,
      schema: { type: "string" },
    })),
    ...queryNames.map((name) => ({
      name,
      in: "query",
      required: true,
      schema: { type: "string" },
    })),
  ];
  const document = {
    openapi: "3.1.0",
    info: { title: input.title.trim(), version: "1.0.0" },
    servers: [{ url: url.origin }],
    paths: {
      [path]: {
        get: {
          operationId: "get" + input.title.replace(/[^A-Za-z0-9]/gu, ""),
          summary: input.summary.trim(),
          description: input.summary.trim(),
          parameters,
          ...(header ? { security: [{ demoApiKey: [] }] } : {}),
          responses: {
            "200": {
              description: "JSON response",
              content: {
                "application/json": {
                  schema: { type: "object", additionalProperties: true },
                },
              },
            },
          },
        },
      },
    },
    ...(header
      ? {
          components: {
            securitySchemes: {
              demoApiKey: { type: "apiKey", in: "header", name: header },
            },
          },
        }
      : {}),
  };
  return JSON.stringify(document, null, 2);
}
