import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { ProviderImportWorkspace } from "@/components/provider-import-workspace";
import { FacetDraftWorkbench } from "@/components/facet-draft-workbench";
import { PublishPreviewDialog } from "@/components/publish-preview-dialog";
import {
  pollImportJob,
  validateOpenApiUpload,
} from "@/lib/openapi-import-client";
import type { ImportJob } from "@/lib/openapi-import";

const queuedJob: ImportJob = {
  id: "019a69b8-1f36-7a12-9ea4-777f09a777ef",
  providerId: "019a69b8-1f36-7a12-9ea4-777f09a777ea",
  apiSourceId: "019a69b8-1f36-7a12-9ea4-777f09a777eb",
  sourceVersionId: null,
  status: "queued",
  warnings: [],
  errorCode: null,
  errorSummary: null,
  createdAt: "2026-11-09T09:00:00.000Z",
};

describe("ProviderImportWorkspace", () => {
  it("renders an accessible import flow with accurate source boundaries", () => {
    const markup = renderToStaticMarkup(<ProviderImportWorkspace />);

    expect(markup).toContain('role="region"');
    expect(markup).toContain('aria-labelledby="provider-console-title"');
    expect(markup).toContain("Provider Console");
    expect(markup).toContain('for="import-provider"');
    expect(markup).toContain('for="new-provider-name"');
    expect(markup).toContain("Create provider");
    expect(markup).toContain('for="import-name"');
    expect(markup).toContain('value="url"');
    expect(markup).toContain('value="paste"');
    expect(markup).toContain('value="upload"');
    expect(markup).toContain("URL of an OpenAPI JSON/YAML document");
    expect(markup).toContain("JSON-content fallback");
    expect(markup).toContain("Multipart upload is not implemented");
    expect(markup).toContain('role="status"');
    expect(markup).toContain('aria-live="polite"');
  });

  it("renders the draft, endpoint and validation workflow without exposing secrets", () => {
    const markup = renderToStaticMarkup(
      <FacetDraftWorkbench
        providerId="019a69b8-1f36-7a12-9ea4-777f09a777ea"
        importJobId="019a69b8-1f36-7a12-9ea4-777f09a777ef"
        operations={[
          {
            id: "019a69b8-1f36-7a12-9ea4-777f09a777ec",
            jsonPointer: "#/paths/~1repos/get",
            operationId: "listRepos",
            method: "GET",
            path: "/repos",
            summary: "List repositories",
            normalizedCandidate: {
              normalized: {
                servers: [{ url: "https://api.example.com" }],
                authAlternatives: [],
              },
            },
            warnings: [],
          },
        ]}
      />,
    );

    expect(markup).toContain("Draft selected operations");
    expect(markup).toContain('for="draft-name-');
    expect(markup).toContain("Where FACET calls your API");
    expect(markup).toContain("validate, and publish");
    expect(markup).toContain("publish");
    expect(markup).toContain("Give it a clear name and description");
    expect(markup).not.toContain("secretRefId");
  });

  it("links the publish call to the live Provider Console", () => {
    const markup = renderToStaticMarkup(<PublishPreviewDialog />);

    expect(markup).toContain('href="#provider-console"');
    expect(markup).not.toContain("Remote fetching is not enabled");
  });
});

describe("pollImportJob", () => {
  it("reports progress and stops immediately when the job becomes ready", async () => {
    const readyJob = { ...queuedJob, status: "ready" as const };
    const responses = [queuedJob, readyJob];
    const fetcher = vi.fn<typeof fetch>(async () => {
      const job = responses.shift();
      if (!job) throw new Error("Unexpected extra poll");
      return Response.json({ job });
    });
    const onUpdate = vi.fn();

    const result = await pollImportJob(queuedJob.id, {
      fetcher,
      wait: async () => undefined,
      onUpdate,
      maxAttempts: 5,
    });

    expect(result).toEqual(readyJob);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  it("treats expired as terminal without another poll", async () => {
    const expiredJob = { ...queuedJob, status: "expired" as const };
    const fetcher = vi.fn<typeof fetch>(async () =>
      Response.json({ job: expiredJob }),
    );

    const result = await pollImportJob(queuedJob.id, {
      fetcher,
      wait: async () => undefined,
      maxAttempts: 5,
    });

    expect(result.status).toBe("expired");
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("does not poll after its abort signal is cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetcher = vi.fn<typeof fetch>();

    await expect(
      pollImportJob(queuedJob.id, {
        fetcher,
        wait: async () => undefined,
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe("validateOpenApiUpload", () => {
  it("accepts bounded JSON or YAML text files", () => {
    expect(
      validateOpenApiUpload({
        name: "openapi.yaml",
        size: 1_024,
        type: "application/yaml",
      }),
    ).toBeNull();
    expect(
      validateOpenApiUpload({
        name: "openapi.json",
        size: 1_024,
        type: "application/json",
      }),
    ).toBeNull();
  });

  it("rejects oversized and unrelated binary files before reading them", () => {
    expect(
      validateOpenApiUpload({
        name: "huge.yaml",
        size: 5_242_881,
        type: "application/yaml",
      }),
    ).toContain("5 MiB");
    expect(
      validateOpenApiUpload({
        name: "archive.zip",
        size: 1_024,
        type: "application/zip",
      }),
    ).toContain("JSON or YAML text file");
  });
});
