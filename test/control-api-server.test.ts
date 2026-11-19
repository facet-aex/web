import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as createImport } from "@/app/api/facet/openapi-imports/route";
import { POST as createActor } from "@/app/api/facet/actors/route";
import { GET as actorPublishStatus } from "@/app/api/facet/actors/[provider]/[facetName]/versions/[version]/publish-status/route";
import { POST as createFacets } from "@/app/api/facet/facets/route";
import { PUT as configureEndpoint } from "@/app/api/facet/facets/[provider]/[facetName]/versions/[version]/endpoint-config/route";
import { POST as validateFacetVersion } from "@/app/api/facet/facets/[provider]/[facetName]/versions/[version]/validate/route";
import { POST as publishFacetVersion } from "@/app/api/facet/facets/[provider]/[facetName]/versions/[version]/publish/route";
import { POST as createSecret } from "@/app/api/facet/providers/[provider]/secrets/route";
import { GET as getImportJob } from "@/app/api/facet/openapi-imports/[jobId]/route";
import {
  proxyControlApi,
  readBoundedRequestBody,
  validateJobId,
} from "@/lib/control-api-server";

const validJobId = "019a69b8-1f36-7a12-9ea4-777f09a777ef";
const validProvider = "alice-labs";
const validFacetName = "vn-gold-fx";
const validVersion = "1.0.0";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Control API server adapter", () => {
  it("forwards Actor idempotency and retrieves provider-only publication status", async () => {
    vi.stubEnv("FACET_ENV", "local");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://localhost:4000");
    vi.stubEnv("FACET_LOCAL_DEV_USER", "owner");
    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json(
        { facet: { status: "REGISTRATION_PENDING" } },
        { status: 202 },
      ),
    );
    vi.stubGlobal("fetch", upstream);
    const publish = await createActor(
      new Request("http://localhost:3000/api/facet/actors", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": "actor-draft-1",
        },
        body: JSON.stringify({
          code: "export default async function run() {}",
        }),
      }),
    );
    expect(publish.status).toBe(202);
    expect(
      new Headers(upstream.mock.calls[0]?.[1]?.headers).get("idempotency-key"),
    ).toBe("actor-draft-1");
    const status = await actorPublishStatus(
      new Request(
        `http://localhost:3000/api/facet/actors/${validProvider}/${validFacetName}/versions/${validVersion}/publish-status`,
      ),
      {
        params: Promise.resolve({
          provider: validProvider,
          facetName: validFacetName,
          version: validVersion,
        }),
      },
    );
    expect(status.status).toBe(202);
    expect(String(upstream.mock.calls[1]?.[0])).toBe(
      `http://localhost:4000/v1/actors/${validProvider}/${validFacetName}/versions/${validVersion}/publish-status`,
    );
  });
  it("forwards JSON to the fixed backend with no caching and local auth", async () => {
    vi.stubEnv("FACET_ENV", "local");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://localhost:4000");
    vi.stubEnv("FACET_LOCAL_DEV_USER", "demo-owner");

    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json(
        { error: { code: "INPUT_INVALID", message: "Invalid source" } },
        { status: 422 },
      ),
    );
    vi.stubGlobal("fetch", upstream);

    const request = new Request(
      "http://localhost:3000/api/facet/openapi-imports",
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ providerId: "provider-1" }),
      },
    );
    const response = await proxyControlApi(request, "/v1/openapi-imports", {
      method: "POST",
      body: await request.text(),
    });

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: { code: "INPUT_INVALID", message: "Invalid source" },
    });
    expect(upstream).toHaveBeenCalledOnce();

    const firstCall = upstream.mock.calls[0];
    if (!firstCall) throw new Error("Expected the Control API fetch");
    const [url, init] = firstCall;
    expect(String(url)).toBe("http://localhost:4000/v1/openapi-imports");
    expect(init).toMatchObject({
      method: "POST",
      cache: "no-store",
      redirect: "error",
      body: '{"providerId":"provider-1"}',
    });
    expect(new Headers(init?.headers).get("x-facet-dev-user")).toBe(
      "demo-owner",
    );
    expect(new Headers(init?.headers).get("content-type")).toBe(
      "application/json",
    );
  });

  it("returns a redacted unavailable response when the backend cannot be reached", async () => {
    vi.stubEnv("FACET_ENV", "local");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://secret-backend:4000");
    vi.stubEnv("FACET_LOCAL_DEV_USER", "secret-user");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("connect ECONNREFUSED http://secret-backend:4000");
      }),
    );

    const response = await proxyControlApi(
      new Request("http://localhost:3000/api/facet/providers"),
      "/v1/me/providers",
    );
    const serialized = JSON.stringify(await response.json());

    expect(response.status).toBe(502);
    expect(serialized).toContain("CONTROL_API_UNAVAILABLE");
    expect(serialized).not.toContain("secret-backend");
    expect(serialized).not.toContain("secret-user");
  });

  it("recognizes UUID job identifiers", () => {
    expect(validateJobId(validJobId)).toBe(true);
    expect(validateJobId("../../health/ready")).toBe(false);
    expect(validateJobId("not-a-uuid")).toBe(false);
  });

  it("rejects a malformed job id before attempting an upstream request", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await getImportJob(
      new Request("http://localhost:3000/api/facet/openapi-imports/not-a-uuid"),
      { params: Promise.resolve({ jobId: "not-a-uuid" }) },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "INPUT_INVALID" },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("rejects an oversized import command before forwarding it", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await createImport(
      new Request("http://localhost:3000/api/facet/openapi-imports", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": "11000000",
        },
        body: "{}",
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "IMPORT_TOO_LARGE" },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("uses a generic bounded-request error for endpoint commands", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await configureEndpoint(
      new Request(
        `http://localhost:3000/api/facet/facets/${validProvider}/${validFacetName}/versions/${validVersion}/endpoint-config`,
        {
          method: "PUT",
          headers: { "content-length": "40000" },
          body: "{}",
        },
      ),
      {
        params: Promise.resolve({
          provider: validProvider,
          facetName: validFacetName,
          version: validVersion,
        }),
      },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: "REQUEST_TOO_LARGE",
        message: "The endpoint configuration request is too large.",
      },
    });
    expect(upstream).not.toHaveBeenCalled();
  });

  it("stops reading a chunked request once the byte budget is exceeded", async () => {
    const request = new Request(
      "http://localhost:3000/api/facet/openapi-imports",
      { method: "POST", body: "123456789" },
    );

    await expect(readBoundedRequestBody(request, 8)).rejects.toMatchObject({
      code: "IMPORT_TOO_LARGE",
    });
  });

  it("forwards fixed Facet draft, secret, endpoint, and validation commands", async () => {
    vi.stubEnv("FACET_ENV", "local");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://localhost:4000");
    vi.stubEnv("FACET_LOCAL_DEV_USER", "demo-owner");
    const upstream = vi.fn<typeof fetch>(async () =>
      Response.json({ ok: true }),
    );
    vi.stubGlobal("fetch", upstream);

    const facetResponse = await createFacets(
      new Request("http://localhost:3000/api/facet/facets", {
        method: "POST",
        body: "{}",
      }),
    );
    const secretResponse = await createSecret(
      new Request(
        `http://localhost:3000/api/facet/providers/${validProvider}/secrets`,
        {
          method: "POST",
          body: "{}",
        },
      ),
      { params: Promise.resolve({ provider: validProvider }) },
    );
    const endpointResponse = await configureEndpoint(
      new Request(
        `http://localhost:3000/api/facet/facets/${validProvider}/${validFacetName}/versions/${validVersion}/endpoint-config`,
        {
          method: "PUT",
          body: "{}",
        },
      ),
      {
        params: Promise.resolve({
          provider: validProvider,
          facetName: validFacetName,
          version: validVersion,
        }),
      },
    );
    const validationResponse = await validateFacetVersion(
      new Request(
        `http://localhost:3000/api/facet/facets/${validProvider}/${validFacetName}/versions/${validVersion}/validate`,
        {
          method: "POST",
          body: "{}",
        },
      ),
      {
        params: Promise.resolve({
          provider: validProvider,
          facetName: validFacetName,
          version: validVersion,
        }),
      },
    );
    const publicationResponse = await publishFacetVersion(
      new Request(
        `http://localhost:3000/api/facet/facets/${validProvider}/${validFacetName}/versions/${validVersion}/publish`,
        {
          method: "POST",
          body: "{}",
        },
      ),
      {
        params: Promise.resolve({
          provider: validProvider,
          facetName: validFacetName,
          version: validVersion,
        }),
      },
    );

    expect([
      facetResponse.status,
      secretResponse.status,
      endpointResponse.status,
      validationResponse.status,
      publicationResponse.status,
    ]).toEqual([200, 200, 200, 200, 200]);
    expect(
      upstream.mock.calls.map(([url, init]) => [String(url), init?.method]),
    ).toEqual([
      ["http://localhost:4000/v1/facets", "POST"],
      [`http://localhost:4000/v1/providers/${validProvider}/secrets`, "POST"],
      [
        `http://localhost:4000/v1/facets/${validProvider}/${validFacetName}/versions/${validVersion}/endpoint-config`,
        "PUT",
      ],
      [
        `http://localhost:4000/v1/facets/${validProvider}/${validFacetName}/versions/${validVersion}/validate`,
        "POST",
      ],
      [
        `http://localhost:4000/v1/facets/${validProvider}/${validFacetName}/versions/${validVersion}/publish`,
        "POST",
      ],
    ]);
  });

  it("rejects invalid provider, facetName, and version segments before proxying", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const invalidProvider = await createSecret(
      new Request("http://localhost:3000/api/facet/providers/nope/secrets", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ provider: "nope" }) },
    );
    const invalidVersion = await configureEndpoint(
      new Request(
        `http://localhost:3000/api/facet/facets/${validProvider}/${validFacetName}/versions/v1/endpoint-config`,
        {
          method: "PUT",
          body: "{}",
        },
      ),
      {
        params: Promise.resolve({
          provider: validProvider,
          facetName: validFacetName,
          version: "v1",
        }),
      },
    );

    expect(invalidProvider.status).toBe(400);
    expect(invalidVersion.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("fails closed with 401 when FACET_AUTH_MODE=clerk has no session token", async () => {
    vi.stubEnv("FACET_ENV", "production");
    vi.stubEnv("FACET_AUTH_MODE", "clerk");
    vi.stubEnv("FACET_CONTROL_API_URL", "http://control-api:4000");
    vi.stubEnv("CLERK_SECRET_KEY", "sk_test_example");
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);

    const response = await proxyControlApi(
      new Request("https://facet.example/api/facet/me"),
      "/v1/me",
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: "AUTHENTICATION_REQUIRED" },
    });
    expect(upstream).not.toHaveBeenCalled();
  });
});
