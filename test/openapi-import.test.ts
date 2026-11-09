import { describe, expect, it } from "vitest";

import {
  MAX_OPENAPI_UPLOAD_BYTES,
  isTerminalImportStatus,
  readErrorEnvelope,
  readWarningMessages,
  toImportRequest,
} from "@/lib/openapi-import";

describe("OpenAPI import UI contract", () => {
  it.each([
    ["queued", false],
    ["fetching", false],
    ["parsing", false],
    ["normalizing", false],
    ["ready", true],
    ["failed", true],
    ["expired", true],
  ] as const)("classifies %s terminal state as %s", (status, expected) => {
    expect(isTerminalImportStatus(status)).toBe(expected);
  });

  it("shapes an HTTPS URL import request", () => {
    expect(
      toImportRequest({
        providerId: "provider-1",
        name: "Remote API",
        sourceKind: "url",
        sourceValue: "https://api.example.com/openapi.json",
      }),
    ).toEqual({
      providerId: "provider-1",
      name: "Remote API",
      source: {
        kind: "url",
        url: "https://api.example.com/openapi.json",
      },
    });
  });

  it.each(["paste", "upload"] as const)(
    "shapes a %s import request with content and media type",
    (sourceKind) => {
      expect(
        toImportRequest({
          providerId: "provider-1",
          name: "Local API",
          sourceKind,
          sourceValue: '{"openapi":"3.1.0"}',
          mediaType: "application/json",
        }),
      ).toEqual({
        providerId: "provider-1",
        name: "Local API",
        source: {
          kind: sourceKind,
          content: '{"openapi":"3.1.0"}',
          mediaType: "application/json",
        },
      });
    },
  );

  it("uses a safe message from a Control API error envelope", () => {
    expect(
      readErrorEnvelope({
        error: { code: "IMPORT_PARSE_FAILED", message: "Spec is invalid." },
      }),
    ).toBe("Spec is invalid.");
    expect(readErrorEnvelope({ error: { message: "   " } })).toBe(
      "The request could not be completed.",
    );
    expect(readErrorEnvelope(null)).toBe("The request could not be completed.");
  });

  it("reads warning messages without trusting arbitrary warning shapes", () => {
    expect(
      readWarningMessages([
        "Top-level warning",
        { code: "missing-operation-id", message: "Operation ID is missing." },
        { code: "ignored-without-message" },
        null,
      ]),
    ).toEqual(["Top-level warning", "Operation ID is missing."]);
    expect(readWarningMessages({ message: "not an array" })).toEqual([]);
  });

  it("uses the Control API five MiB upload boundary", () => {
    expect(MAX_OPENAPI_UPLOAD_BYTES).toBe(5_242_880);
    expect(MAX_OPENAPI_UPLOAD_BYTES - 1).toBeLessThan(MAX_OPENAPI_UPLOAD_BYTES);
  });
});
