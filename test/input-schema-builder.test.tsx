import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { InputSchemaBuilder } from "@/components/input-schema-builder";
import { StudioShell } from "@/components/studio-shell";
import {
  isFlatEditableSchema,
  parseInputSchemaText,
  schemaToVisualFields,
  visualFieldsToSchema,
} from "@/lib/input-schema-builder";

describe("input-schema-builder helpers", () => {
  it("converts flat JSON Schema properties into visual fields and back cleanly", () => {
    const schema = {
      type: "object",
      required: ["question", "limit"],
      properties: {
        question: {
          type: "string",
          default: "Vietnam fintech summary",
          description: "Task prompt",
        },
        focus: {
          type: "string",
          enum: ["ALL", "GOLD", "NEWS"],
          default: "ALL",
        },
        limit: {
          type: "integer",
          default: 5,
        },
        includeRaw: {
          type: "boolean",
          default: false,
        },
        articles: {
          type: "array",
          default: [{ title: "Sample" }],
        },
      },
    };

    const extracted = schemaToVisualFields(schema);
    expect(extracted.editable).toBe(true);
    expect(extracted.fields.map((f) => f.name)).toEqual([
      "question",
      "focus",
      "limit",
      "includeRaw",
      "articles",
    ]);
    expect(extracted.fields[0]?.required).toBe(true);
    expect(extracted.fields[1]?.enumValues).toBe("ALL, GOLD, NEWS");

    const rebuilt = visualFieldsToSchema(extracted.fields);
    expect(rebuilt).toMatchObject({
      type: "object",
      required: ["question", "limit"],
      properties: {
        question: {
          type: "string",
          default: "Vietnam fintech summary",
          description: "Task prompt",
        },
        focus: {
          type: "string",
          enum: ["ALL", "GOLD", "NEWS"],
          default: "ALL",
        },
        limit: { type: "integer", default: 5 },
        includeRaw: { type: "boolean", default: false },
        articles: { type: "array", default: [{ title: "Sample" }] },
      },
    });
  });

  it("protects non-flat schemas (anyOf or nested object) by falling back to Raw JSON mode", () => {
    const complexSchema = {
      type: "object",
      anyOf: [{ required: ["goldQuotes"] }, { required: ["fxQuotes"] }],
      properties: {
        nested: {
          type: "object",
          properties: { brand: { type: "string" } },
        },
      },
    };

    expect(isFlatEditableSchema(complexSchema).editable).toBe(false);
    expect(schemaToVisualFields(complexSchema).editable).toBe(false);
  });

  it("validates parsed schema JSON strings", () => {
    expect(parseInputSchemaText('{"type":"object","properties":{}}')).toEqual({
      schema: { type: "object", properties: {} },
      error: null,
    });
    expect(parseInputSchemaText("[]").error).toContain("JSON object");
    expect(parseInputSchemaText("{invalid").error).toContain("valid JSON");
  });
});

describe("InputSchemaBuilder and StudioShell", () => {
  it("renders Visual Builder, Raw JSON, and Form Preview tabs", () => {
    const markup = renderToStaticMarkup(
      <InputSchemaBuilder
        value={JSON.stringify({
          type: "object",
          properties: {
            brand: { type: "string", enum: ["ALL", "SJC"], default: "ALL" },
          },
        })}
        onChange={() => undefined}
      />,
    );

    expect(markup).toContain("Visual Builder");
    expect(markup).toContain("Raw JSON");
    expect(markup).toContain("Form Preview");
    expect(markup).toContain("Add Field");
  });

  it("renders StudioShell with top Studio dropdown links and without sub-navbar or overview back bar", () => {
    const markup = renderToStaticMarkup(
      <StudioShell activeType="actor" publishableKey={undefined}>
        <div>Studio content</div>
      </StudioShell>,
    );

    expect(markup).not.toContain("studio-subnav-wrap");
    expect(markup).not.toContain("studio-breadcrumb");
    expect(markup).not.toContain("← Studio Overview");
    expect(markup).toContain('href="/studio"');
    expect(markup).toContain('href="/studio/api"');
    expect(markup).toContain('href="/studio/actor"');
    expect(markup).toContain('href="/studio/agent"');
    expect(markup).toContain("Studio content");
  });
});
