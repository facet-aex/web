"use client";

import { useState, type FormEvent } from "react";
import type { PublicFacet } from "@/lib/public-catalog";

interface SchemaProperty {
  type?: string;
  enum?: unknown[];
  default?: unknown;
  description?: string;
  properties?: Record<string, SchemaProperty>;
}

interface InvokeSuccessPayload {
  runId: string;
  facetVersionId: string;
  facetType?: string;
  result: unknown;
  dataset?: Record<string, unknown>[];
  usage?: {
    itemCount: number;
    durationMs: number;
    outputHash: string;
    runnerSignature: string;
  };
  replayed: boolean;
  payment?: {
    transaction: string;
    network: string;
    amountAtomic?: string;
    payTo?: string;
  };
  receipt?: {
    inputHash: string;
    outputHash: string;
    itemCount: number;
    paymentTxHash: string;
    receiptTxHash?: string;
    runnerSignature: string;
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function buildInitialInput(schema: unknown): Record<string, unknown> {
  if (!isRecord(schema) || !isRecord(schema.properties)) return {};
  const result: Record<string, unknown> = {};
  for (const [key, rawProp] of Object.entries(schema.properties)) {
    if (!isRecord(rawProp)) continue;
    const prop = rawProp as SchemaProperty;
    if (prop.type === "object" && isRecord(prop.properties)) {
      result[key] = buildInitialInput(prop);
    } else if (prop.default !== undefined) {
      result[key] = prop.default;
    } else if (Array.isArray(prop.enum) && prop.enum.length > 0) {
      result[key] = prop.enum[0];
    } else if (prop.type === "integer" || prop.type === "number") {
      result[key] = 1;
    } else if (prop.type === "boolean") {
      result[key] = false;
    } else {
      result[key] = "";
    }
  }
  return result;
}

function flattenSchemaFields(
  schema: unknown,
  prefix: string[] = [],
): Array<{
  path: string[];
  label: string;
  prop: SchemaProperty;
}> {
  if (!isRecord(schema) || !isRecord(schema.properties)) return [];
  const fields: Array<{ path: string[]; label: string; prop: SchemaProperty }> =
    [];
  for (const [key, rawProp] of Object.entries(schema.properties)) {
    if (!isRecord(rawProp)) continue;
    const prop = rawProp as SchemaProperty;
    if (prop.type === "object" && isRecord(prop.properties)) {
      fields.push(...flattenSchemaFields(prop, [...prefix, key]));
    } else {
      fields.push({
        path: [...prefix, key],
        label: [...prefix, key].join("."),
        prop,
      });
    }
  }
  return fields;
}

function getAtPath(obj: Record<string, unknown>, path: string[]): unknown {
  let cursor: unknown = obj;
  for (const segment of path) {
    if (!isRecord(cursor)) return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

function setAtPath(
  obj: Record<string, unknown>,
  path: string[],
  value: unknown,
): Record<string, unknown> {
  if (path.length === 0) return obj;
  const [head, ...rest] = path;
  if (!head) return obj;
  if (rest.length === 0) {
    return { ...obj, [head]: value };
  }
  const child = isRecord(obj[head])
    ? (obj[head] as Record<string, unknown>)
    : {};
  return { ...obj, [head]: setAtPath(child, rest, value) };
}

function extractDatasetRows(
  response: InvokeSuccessPayload | null,
): Record<string, unknown>[] {
  if (!response) return [];
  if (Array.isArray(response.dataset)) {
    return response.dataset.filter(isRecord);
  }
  if (Array.isArray(response.result)) {
    return response.result.filter(isRecord);
  }
  if (isRecord(response.result) && Array.isArray(response.result.items)) {
    return response.result.items.filter(isRecord);
  }
  if (isRecord(response.result)) {
    return [response.result];
  }
  return [];
}

function formatAtomicFusd(atomic?: string): string {
  if (!atomic || !/^[0-9]+$/u.test(atomic)) return "0.001 fUSD";
  const value = Number(atomic) / 1_000_000;
  return `${value} fUSD`;
}

export function FacetPlayground({ facet }: { facet: PublicFacet }) {
  const fields = flattenSchemaFields(facet.inputSchema);
  const [formValue, setFormValue] = useState<Record<string, unknown>>(() =>
    buildInitialInput(facet.inputSchema),
  );
  const [rawMode, setRawMode] = useState(fields.length === 0);
  const [rawJson, setRawJson] = useState(() =>
    JSON.stringify(buildInitialInput(facet.inputSchema), null, 2),
  );
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [output, setOutput] = useState<InvokeSuccessPayload | null>(null);
  const [viewTab, setViewTab] = useState<"dataset" | "json">("dataset");

  async function handleRun(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setRunning(true);

    let inputPayload: Record<string, unknown>;
    if (rawMode) {
      try {
        const parsed = JSON.parse(rawJson) as unknown;
        if (!isRecord(parsed)) {
          throw new Error("Input JSON must be an object.");
        }
        inputPayload = parsed;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Invalid JSON input.");
        setRunning(false);
        return;
      }
    } else {
      inputPayload = formValue;
    }

    try {
      const response = await fetch("/api/facet/invoke", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          facetVersionId: facet.versionId,
          input: inputPayload,
        }),
      });
      const body = (await response.json().catch(() => null)) as
        | (InvokeSuccessPayload & {
            error?: { code?: string; message?: string };
          })
        | null;

      if (!response.ok || !body || !body.runId) {
        throw new Error(
          body?.error?.message ??
            body?.error?.code ??
            `Execution failed (HTTP ${response.status}).`,
        );
      }
      setOutput(body);
      setViewTab("dataset");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Execution failed.");
    } finally {
      setRunning(false);
    }
  }

  const datasetRows = extractDatasetRows(output);
  const columns = Array.from(
    new Set(datasetRows.flatMap((row) => Object.keys(row))),
  );

  return (
    <section className="playground-section" aria-labelledby="playground-title">
      <div className="playground-header">
        <div>
          <p className="eyebrow">Interactive Runner &amp; x402 Checkout</p>
          <h2 id="playground-title">Input-Schema Form</h2>
        </div>
        <button
          type="button"
          className="button button-ghost"
          onClick={() => {
            if (!rawMode) {
              setRawJson(JSON.stringify(formValue, null, 2));
            } else {
              try {
                const parsed = JSON.parse(rawJson) as unknown;
                if (isRecord(parsed)) setFormValue(parsed);
              } catch {
                // Keep existing formValue if raw JSON is incomplete
              }
            }
            setRawMode((prev) => !prev);
          }}
        >
          {rawMode ? "Switch to Schema Form" : "Switch to Raw JSON"}
        </button>
      </div>

      <form className="playground-form" onSubmit={handleRun}>
        {rawMode ? (
          <div className="form-field">
            <label htmlFor="playground-raw-json">Input JSON</label>
            <textarea
              id="playground-raw-json"
              value={rawJson}
              onChange={(e) => setRawJson(e.target.value)}
              rows={8}
              spellCheck={false}
            />
          </div>
        ) : (
          <div className="playground-fields">
            {fields.map(({ path, label, prop }) => {
              const current = getAtPath(formValue, path);
              const inputId = `field-${label}`;
              if (Array.isArray(prop.enum) && prop.enum.length > 0) {
                return (
                  <div className="form-field" key={label}>
                    <label htmlFor={inputId}>{label}</label>
                    <select
                      id={inputId}
                      value={String(current ?? prop.enum[0])}
                      onChange={(e) =>
                        setFormValue((prev) =>
                          setAtPath(prev, path, e.target.value),
                        )
                      }
                    >
                      {prop.enum.map((opt) => (
                        <option key={String(opt)} value={String(opt)}>
                          {String(opt)}
                        </option>
                      ))}
                    </select>
                    {prop.description ? (
                      <small>{prop.description}</small>
                    ) : null}
                  </div>
                );
              }
              if (prop.type === "boolean") {
                return (
                  <div className="form-field" key={label}>
                    <label htmlFor={inputId}>
                      <input
                        id={inputId}
                        type="checkbox"
                        checked={Boolean(current)}
                        onChange={(e) =>
                          setFormValue((prev) =>
                            setAtPath(prev, path, e.target.checked),
                          )
                        }
                      />{" "}
                      {label}
                    </label>
                    {prop.description ? (
                      <small>{prop.description}</small>
                    ) : null}
                  </div>
                );
              }
              const isNumeric =
                prop.type === "integer" || prop.type === "number";
              return (
                <div className="form-field" key={label}>
                  <label htmlFor={inputId}>{label}</label>
                  <input
                    id={inputId}
                    type={isNumeric ? "number" : "text"}
                    value={String(current ?? "")}
                    onChange={(e) =>
                      setFormValue((prev) =>
                        setAtPath(
                          prev,
                          path,
                          isNumeric ? Number(e.target.value) : e.target.value,
                        ),
                      )
                    }
                  />
                  {prop.description ? <small>{prop.description}</small> : null}
                </div>
              );
            })}
          </div>
        )}

        {error ? (
          <div className="error-banner" role="alert">
            <strong>Execution failed</strong>
            <p>{error}</p>
          </div>
        ) : null}

        <button
          type="submit"
          className="button button-primary"
          disabled={running}
        >
          {running
            ? "Paying via x402 & Executing…"
            : `Pay ${formatAtomicFusd(facet.pricing?.priceAtomic)} via x402 & Run`}
          <span aria-hidden="true">↗</span>
        </button>
      </form>

      {output ? (
        <div className="run-output" aria-live="polite">
          <div className="run-output-header">
            <div>
              <p className="eyebrow">Run Completed</p>
              <h3>Dataset &amp; On-Chain Proof</h3>
            </div>
            <div className="studio-tabs">
              <button
                type="button"
                className={`tab-button ${viewTab === "dataset" ? "tab-active" : ""}`}
                onClick={() => setViewTab("dataset")}
              >
                Dataset Table ({datasetRows.length})
              </button>
              <button
                type="button"
                className={`tab-button ${viewTab === "json" ? "tab-active" : ""}`}
                onClick={() => setViewTab("json")}
              >
                Raw JSON
              </button>
            </div>
          </div>

          {viewTab === "dataset" && datasetRows.length > 0 ? (
            <div className="dataset-table-wrap">
              <table className="dataset-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {columns.map((col) => (
                      <th key={col}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {datasetRows.map((row, idx) => (
                    <tr key={idx}>
                      <td>{idx + 1}</td>
                      {columns.map((col) => {
                        const cell = row[col];
                        return (
                          <td key={col}>
                            {typeof cell === "object" && cell !== null
                              ? JSON.stringify(cell)
                              : String(cell ?? "")}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <pre className="json-pre">{JSON.stringify(output, null, 2)}</pre>
          )}

          <div className="receipt-panel">
            <h4>Avalanche Fuji On-Chain Proof &amp; Receipt</h4>
            <dl className="receipt-grid">
              <div>
                <dt>Run ID</dt>
                <dd>{output.runId}</dd>
              </div>
              {output.usage ? (
                <>
                  <div>
                    <dt>Usage</dt>
                    <dd>
                      {output.usage.itemCount} items in{" "}
                      {output.usage.durationMs}
                      ms
                    </dd>
                  </div>
                  <div>
                    <dt>Output Hash</dt>
                    <dd>{output.usage.outputHash}</dd>
                  </div>
                  <div>
                    <dt>Runner Signature</dt>
                    <dd>{output.usage.runnerSignature}</dd>
                  </div>
                </>
              ) : null}
              {output.payment?.transaction ? (
                <div>
                  <dt>x402 Settlement Tx (Fuji)</dt>
                  <dd>
                    <a
                      className="explorer-link"
                      href={`https://testnet.snowtrace.io/tx/${output.payment.transaction}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {output.payment.transaction} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
              {output.receipt?.receiptTxHash ? (
                <div>
                  <dt>On-Chain ReceiptLog Tx</dt>
                  <dd>
                    <a
                      className="explorer-link"
                      href={`https://testnet.snowtrace.io/tx/${output.receipt.receiptTxHash}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {output.receipt.receiptTxHash} ↗
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </div>
      ) : null}
    </section>
  );
}
