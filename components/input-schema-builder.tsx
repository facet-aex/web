"use client";

import { useState } from "react";

import {
  parseInputSchemaText,
  schemaToVisualFields,
  visualFieldsToSchema,
  type SchemaFieldType,
  type VisualSchemaField,
} from "@/lib/input-schema-builder";

interface InputSchemaBuilderProps {
  value: string;
  onChange: (nextJsonText: string) => void;
  disabled?: boolean;
  idPrefix?: string;
}

type BuilderTab = "visual" | "raw" | "preview";

function makeBlankField(index: number): VisualSchemaField {
  return {
    id: `field-new-${Date.now()}-${index}`,
    name: `param_${index + 1}`,
    type: "string",
    required: false,
    defaultValue: "",
    enumValues: "",
    description: "",
  };
}

export function InputSchemaBuilder({
  value,
  onChange,
  disabled = false,
  idPrefix = "schema",
}: InputSchemaBuilderProps) {
  const parsed = parseInputSchemaText(value);
  const extracted = parsed.schema
    ? schemaToVisualFields(parsed.schema)
    : {
        editable: false,
        reason: parsed.error ?? "Invalid JSON Schema.",
        fields: [],
      };

  const [tab, setTab] = useState<BuilderTab>(() =>
    extracted.editable ? "visual" : "raw",
  );

  function commitFields(nextFields: VisualSchemaField[]) {
    onChange(JSON.stringify(visualFieldsToSchema(nextFields), null, 2));
  }

  function updateField(index: number, patch: Partial<VisualSchemaField>) {
    const next = extracted.fields.map((field, idx) =>
      idx === index ? { ...field, ...patch } : field,
    );
    commitFields(next);
  }

  function addField() {
    commitFields([
      ...extracted.fields,
      makeBlankField(extracted.fields.length),
    ]);
  }

  function removeField(index: number) {
    commitFields(extracted.fields.filter((_, idx) => idx !== index));
  }

  return (
    <div className="schema-builder">
      <div className="schema-builder-bar">
        <div className="studio-tabs" role="tablist" aria-label="Schema mode">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "visual"}
            className={`tab-button ${tab === "visual" ? "tab-active" : ""}`}
            onClick={() => setTab("visual")}
          >
            Visual Builder ({extracted.fields.length})
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "raw"}
            className={`tab-button ${tab === "raw" ? "tab-active" : ""}`}
            onClick={() => setTab("raw")}
          >
            Raw JSON
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "preview"}
            className={`tab-button ${tab === "preview" ? "tab-active" : ""}`}
            onClick={() => setTab("preview")}
          >
            Form Preview
          </button>
        </div>

        {tab === "visual" && extracted.editable ? (
          <button
            type="button"
            className="preset-chip"
            disabled={disabled}
            onClick={addField}
          >
            + Add Field
          </button>
        ) : null}
      </div>

      {tab === "visual" ? (
        extracted.editable ? (
          <div className="schema-visual-list">
            {extracted.fields.length === 0 ? (
              <div className="schema-empty">
                <p>
                  No input parameters defined yet. Click{" "}
                  <strong>+ Add Field</strong> to build an Apify-style input
                  form.
                </p>
              </div>
            ) : (
              extracted.fields.map((field, index) => (
                <div className="schema-field-card" key={`${field.id}-${index}`}>
                  <div className="schema-field-row">
                    <div className="form-field">
                      <label htmlFor={`${idPrefix}-name-${index}`}>
                        Property Key
                      </label>
                      <input
                        id={`${idPrefix}-name-${index}`}
                        value={field.name}
                        disabled={disabled}
                        onChange={(e) =>
                          updateField(index, { name: e.target.value })
                        }
                        placeholder="query"
                      />
                    </div>
                    <div className="form-field">
                      <label htmlFor={`${idPrefix}-type-${index}`}>Type</label>
                      <select
                        id={`${idPrefix}-type-${index}`}
                        value={field.type}
                        disabled={disabled}
                        onChange={(e) =>
                          updateField(index, {
                            type: e.target.value as SchemaFieldType,
                          })
                        }
                      >
                        <option value="string">string</option>
                        <option value="integer">integer</option>
                        <option value="number">number</option>
                        <option value="boolean">boolean</option>
                        <option value="array">array</option>
                      </select>
                    </div>
                    <div className="form-field">
                      <label htmlFor={`${idPrefix}-default-${index}`}>
                        Default
                      </label>
                      <input
                        id={`${idPrefix}-default-${index}`}
                        value={field.defaultValue}
                        disabled={disabled}
                        onChange={(e) =>
                          updateField(index, { defaultValue: e.target.value })
                        }
                        placeholder={
                          field.type === "array"
                            ? '[{"key":"value"}]'
                            : "Default value"
                        }
                      />
                    </div>
                    <div className="schema-field-controls">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={field.required}
                          disabled={disabled}
                          onChange={(e) =>
                            updateField(index, { required: e.target.checked })
                          }
                        />
                        <span>Required</span>
                      </label>
                      <button
                        type="button"
                        className="preset-chip danger-chip"
                        disabled={disabled}
                        onClick={() => removeField(index)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                  <div className="schema-field-row-secondary">
                    <div className="form-field">
                      <label htmlFor={`${idPrefix}-desc-${index}`}>
                        Description (shown in Store &amp; MCP)
                      </label>
                      <input
                        id={`${idPrefix}-desc-${index}`}
                        value={field.description}
                        disabled={disabled}
                        onChange={(e) =>
                          updateField(index, { description: e.target.value })
                        }
                        placeholder="Explain what this parameter controls"
                      />
                    </div>
                    {field.type === "string" ||
                    field.type === "integer" ||
                    field.type === "number" ? (
                      <div className="form-field">
                        <label htmlFor={`${idPrefix}-enum-${index}`}>
                          Enum Options (comma-separated, optional)
                        </label>
                        <input
                          id={`${idPrefix}-enum-${index}`}
                          value={field.enumValues}
                          disabled={disabled}
                          onChange={(e) =>
                            updateField(index, { enumValues: e.target.value })
                          }
                          placeholder="ALL, SJC, DOJI"
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="schema-fallback-banner">
            <strong>Visual Builder locked for advanced schema</strong>
            <p>{extracted.reason}</p>
            <div className="schema-fallback-actions">
              <button
                type="button"
                className="button button-secondary"
                onClick={() => setTab("raw")}
              >
                Edit in Raw JSON
              </button>
              <button
                type="button"
                className="button button-ghost"
                disabled={disabled}
                onClick={() =>
                  onChange(
                    JSON.stringify({ type: "object", properties: {} }, null, 2),
                  )
                }
              >
                Reset to Flat Schema
              </button>
            </div>
          </div>
        )
      ) : null}

      {tab === "raw" ? (
        <div className="form-field">
          <label htmlFor={`${idPrefix}-raw-json`}>
            Input Schema (JSON Schema 2020-12)
          </label>
          <textarea
            id={`${idPrefix}-raw-json`}
            value={value}
            disabled={disabled}
            onChange={(e) => onChange(e.target.value)}
            rows={12}
            spellCheck={false}
          />
          {parsed.error ? (
            <small className="field-warning">{parsed.error}</small>
          ) : null}
        </div>
      ) : null}

      {tab === "preview" ? (
        <div className="schema-preview-box">
          {extracted.fields.length === 0 ? (
            <p className="schema-preview-empty">
              {extracted.editable
                ? "Add fields in Visual Builder or Raw JSON to preview the buyer playground form."
                : "Complex schemas render in Raw JSON mode or as typed fields in the Store Playground."}
            </p>
          ) : (
            <div className="playground-fields">
              {extracted.fields.map((field) => {
                const enums = field.enumValues
                  .split(",")
                  .map((v) => v.trim())
                  .filter(Boolean);
                return (
                  <div className="form-field" key={`preview-${field.id}`}>
                    <label>
                      {field.name}
                      {field.required ? " *" : ""}
                    </label>
                    {enums.length > 0 ? (
                      <select
                        disabled
                        defaultValue={field.defaultValue || enums[0]}
                      >
                        {enums.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    ) : field.type === "boolean" ? (
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          disabled
                          defaultChecked={field.defaultValue === "true"}
                        />
                        <span>{field.defaultValue || "false"}</span>
                      </label>
                    ) : field.type === "array" ? (
                      <textarea
                        rows={3}
                        readOnly
                        value={field.defaultValue || "[]"}
                      />
                    ) : (
                      <input
                        readOnly
                        type={
                          field.type === "integer" || field.type === "number"
                            ? "number"
                            : "text"
                        }
                        value={field.defaultValue}
                        placeholder={`<${field.type}>`}
                      />
                    )}
                    {field.description ? (
                      <small>{field.description}</small>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
