import { afterEach, describe, expect, it, vi } from "vitest";

import { POST as createImport } from "@/app/api/facet/openapi-imports/route";
import { POST as createFacets } from "@/app/api/facet/facets/route";
import { PUT as configureEndpoint } from "@/app/api/facet/facet-versions/[versionId]/endpoint-config/route";
import { POST as validateFacetVersion } from "@/app/api/facet/facet-versions/[versionId]/validate/route";
import { POST as publishFacetVersion } from "@/app/api/facet/facet-versions/[versionId]/publish/route";
import { POST as createSecret } from "@/app/api/facet/providers/[providerId]/secrets/route";
import { GET as getImportJob } from "@/app/api/facet/openapi-imports/[jobId]/route";
import {
  proxyControlApi,
  readBoundedRequestBody,
  validateJobId,
} from "@/lib/control-api-server";

const validJobId = "019a69b8-1f36-7a12-9ea4-777f09a777ef";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Control API server adapter", () => {
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
        `http://localhost:3000/api/facet/facet-versions/${validJobId}/endpoint-config`,
        {
          method: "PUT",
          headers: { "content-length": "40000" },
          body: "{}",
        },
      ),
      { params: Promise.resolve({ versionId: validJobId }) },
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
    const providerId = "019a69b8-1f36-7a12-9ea4-777f09a777ea";
    const versionId = "019a69b8-1f36-7a12-9ea4-777f09a777eb";

    const facetResponse = await createFacets(
      new Request("http://localhost:3000/api/facet/facets", {
        method: "POST",
        body: "{}",
      }),
    );
    const secretResponse = await createSecret(
      new Request(
        `http://localhost:3000/api/facet/providers/${providerId}/secrets`,
        {
          method: "POST",
          body: "{}",
        },
      ),
      { params: Promise.resolve({ providerId }) },
    );
    const endpointResponse = await configureEndpoint(
      new Request(
        `http://localhost:3000/api/facet/facet-versions/${versionId}/endpoint-config`,
        {
          method: "PUT",
          body: "{}",
        },
      ),
      { params: Promise.resolve({ versionId }) },
    );
    const validationResponse = await validateFacetVersion(
      new Request(
        `http://localhost:3000/api/facet/facet-versions/${versionId}/validate`,
        {
          method: "POST",
          body: "{}",
        },
      ),
      { params: Promise.resolve({ versionId }) },
    );
    const publicationResponse = await publishFacetVersion(
      new Request(
        `http://localhost:3000/api/facet/facet-versions/${versionId}/publish`,
        {
          method: "POST",
          body: "{}",
        },
      ),
      { params: Promise.resolve({ versionId }) },
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
      [`http://localhost:4000/v1/providers/${providerId}/secrets`, "POST"],
      [
        `http://localhost:4000/v1/facet-versions/${versionId}/endpoint-config`,
        "PUT",
      ],
      [`http://localhost:4000/v1/facet-versions/${versionId}/validate`, "POST"],
      [`http://localhost:4000/v1/facet-versions/${versionId}/publish`, "POST"],
    ]);
  });

  it("rejects invalid provider and version IDs before proxying", async () => {
    const upstream = vi.fn();
    vi.stubGlobal("fetch", upstream);
    const invalidProvider = await createSecret(
      new Request("http://localhost:3000/api/facet/providers/nope/secrets", {
        method: "POST",
        body: "{}",
      }),
      { params: Promise.resolve({ providerId: "nope" }) },
    );
    const invalidVersion = await configureEndpoint(
      new Request(
        "http://localhost:3000/api/facet/facet-versions/nope/endpoint-config",
        {
          method: "PUT",
          body: "{}",
        },
      ),
      { params: Promise.resolve({ versionId: "nope" }) },
    );

    expect(invalidProvider.status).toBe(400);
    expect(invalidVersion.status).toBe(400);
    expect(upstream).not.toHaveBeenCalled();
  });
});
