"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  ACTOR_TEMPLATE_PRESETS,
  AGENT_TEMPLATE_PRESET,
} from "@/lib/actor-templates";

interface ProviderMembership {
  provider: {
    id: string;
    name: string;
    slug: string;
  };
  role: string;
}

type StudioMode = "actor" | "agent";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function ActorAgentStudio() {
  const [mode, setMode] = useState<StudioMode>("actor");
  const [memberships, setMemberships] = useState<ProviderMembership[]>([]);
  const [providerId, setProviderId] = useState("");
  const [loadingProviders, setLoadingProviders] = useState(true);

  const defaultActor = ACTOR_TEMPLATE_PRESETS[0]!;
  const [name, setName] = useState(defaultActor.name);
  const [slug, setSlug] = useState(defaultActor.slug);
  const [category, setCategory] = useState(defaultActor.category);
  const [description, setDescription] = useState(defaultActor.description);
  const [pricingModel, setPricingModel] = useState<
    "PAY_PER_RUN" | "PAY_PER_RESULT"
  >(defaultActor.pricingModel);
  const [priceAtomic, setPriceAtomic] = useState(defaultActor.priceAtomic);
  const [payTo, setPayTo] = useState("");
  const [inputSchemaText, setInputSchemaText] = useState(
    JSON.stringify(defaultActor.inputSchema, null, 2),
  );
  const [code, setCode] = useState(defaultActor.code);
  const [erc8004TokenId, setErc8004TokenId] = useState(
    AGENT_TEMPLATE_PRESET.erc8004TokenId,
  );
  const [taskKind, setTaskKind] = useState(AGENT_TEMPLATE_PRESET.taskKind);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<{
    id: string;
    slug: string;
    facetType: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const res = await fetch("/api/facet/providers", {
          cache: "no-store",
          signal: controller.signal,
        });
        const body = (await res.json().catch(() => null)) as {
          memberships?: ProviderMembership[];
        } | null;
        if (res.ok && Array.isArray(body?.memberships)) {
          setMemberships(body.memberships);
          setProviderId(body.memberships[0]?.provider.id ?? "");
        }
      } catch {
        // Provider list errors are surfaced in the main Provider Console
      } finally {
        if (!controller.signal.aborted) setLoadingProviders(false);
      }
    })();
    return () => controller.abort();
  }, []);

  function applyActorPreset(presetId: string) {
    const preset = ACTOR_TEMPLATE_PRESETS.find((item) => item.id === presetId);
    if (!preset) return;
    setMode("actor");
    setName(preset.name);
    setSlug(preset.slug);
    setCategory(preset.category);
    setDescription(preset.description);
    setPricingModel(preset.pricingModel);
    setPriceAtomic(preset.priceAtomic);
    setInputSchemaText(JSON.stringify(preset.inputSchema, null, 2));
    setCode(preset.code);
    setError(null);
    setPublished(null);
  }

  function applyAgentPreset() {
    setMode("agent");
    setName(AGENT_TEMPLATE_PRESET.name);
    setSlug(AGENT_TEMPLATE_PRESET.slug);
    setCategory(AGENT_TEMPLATE_PRESET.category);
    setDescription(AGENT_TEMPLATE_PRESET.description);
    setPricingModel(AGENT_TEMPLATE_PRESET.pricingModel);
    setPriceAtomic(AGENT_TEMPLATE_PRESET.priceAtomic);
    setInputSchemaText(
      JSON.stringify(AGENT_TEMPLATE_PRESET.inputSchema, null, 2),
    );
    setErc8004TokenId(AGENT_TEMPLATE_PRESET.erc8004TokenId);
    setTaskKind(AGENT_TEMPLATE_PRESET.taskKind);
    setError(null);
    setPublished(null);
  }

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPublished(null);

    if (!providerId) {
      setError(
        "Create or select a provider first (below in the Provider Console).",
      );
      return;
    }

    let parsedSchema: unknown;
    try {
      parsedSchema = JSON.parse(inputSchemaText);
    } catch {
      setError("Input schema must be valid JSON.");
      return;
    }
    if (!isRecord(parsedSchema) || Array.isArray(parsedSchema)) {
      setError("Input schema must be a JSON object.");
      return;
    }

    setSubmitting(true);
    try {
      const endpoint =
        mode === "actor" ? "/api/facet/actors" : "/api/facet/agent-facets";
      const payload =
        mode === "actor"
          ? {
              providerId,
              name: name.trim(),
              slug: slug.trim(),
              description: description.trim(),
              category: category.trim(),
              tags: ["vietnam", "actor", "docker"],
              inputSchema: parsedSchema,
              code,
              pricingModel,
              priceAtomic: priceAtomic.trim() || "1000",
              ...(payTo.trim() ? { payTo: payTo.trim() } : {}),
            }
          : {
              providerId,
              name: name.trim(),
              slug: slug.trim(),
              description: description.trim(),
              category: category.trim(),
              tags: ["vietnam", "a2a", "erc8004"],
              erc8004TokenId: erc8004TokenId.trim(),
              taskKind: taskKind.trim(),
              inputSchema: parsedSchema,
              pricingModel,
              priceAtomic: priceAtomic.trim() || "1000",
              ...(payTo.trim() ? { payTo: payTo.trim() } : {}),
            };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json().catch(() => null)) as {
        facet?: {
          id: string;
          slug: string;
          facetType: string;
          imageDigest?: string;
          erc8004TokenId?: string;
        };
        error?: { message?: string };
      } | null;

      if (!res.ok || !body?.facet) {
        throw new Error(body?.error?.message ?? "Failed to publish Facet.");
      }

      setPublished({
        id: body.facet.id,
        slug: body.facet.slug,
        facetType: body.facet.facetType,
        detail:
          body.facet.imageDigest ??
          `ERC-8004 Token #${body.facet.erc8004TokenId ?? erc8004TokenId}`,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not publish capability.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="studio-panel" aria-labelledby="actor-studio-title">
      <div className="studio-header">
        <div>
          <p className="eyebrow">Minimalist 1-Step Publishing</p>
          <h3 id="actor-studio-title">
            Push Node.js Actor or ERC-8004 A2A Agent
          </h3>
        </div>
        <div className="studio-tabs" role="tablist" aria-label="Publish mode">
          <button
            type="button"
            role="tab"
            aria-selected={mode === "actor"}
            className={`tab-button ${mode === "actor" ? "tab-active" : ""}`}
            onClick={() => {
              setMode("actor");
              setError(null);
            }}
          >
            Hosted Actor (Docker)
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === "agent"}
            className={`tab-button ${mode === "agent" ? "tab-active" : ""}`}
            onClick={applyAgentPreset}
          >
            A2A Agent (ERC-8004)
          </button>
        </div>
      </div>

      <div className="preset-bar">
        <span>1-Click Sample Presets:</span>
        {ACTOR_TEMPLATE_PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className="preset-chip"
            onClick={() => applyActorPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          className="preset-chip"
          onClick={applyAgentPreset}
        >
          VN Market Analyst (ERC-8004 A2A)
        </button>
      </div>

      <form className="studio-form" onSubmit={handlePublish}>
        <div className="studio-grid">
          <div className="form-field">
            <label htmlFor="studio-provider">Provider</label>
            <select
              id="studio-provider"
              value={providerId}
              onChange={(e) => setProviderId(e.target.value)}
              disabled={loadingProviders || submitting}
              required
            >
              <option value="">
                {loadingProviders
                  ? "Loading providers…"
                  : memberships.length
                    ? "Choose provider"
                    : "Create a provider below first"}
              </option>
              {memberships.map((m) => (
                <option key={m.provider.id} value={m.provider.id}>
                  {m.provider.name} / {m.role}
                </option>
              ))}
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="studio-name">Name</label>
            <input
              id="studio-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="studio-slug">Slug</label>
            <input
              id="studio-slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              pattern="^[a-z0-9]+(?:-[a-z0-9]+)*$"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="studio-category">Category</label>
            <input
              id="studio-category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="studio-pricing-model">x402 Pricing Model</label>
            <select
              id="studio-pricing-model"
              value={pricingModel}
              onChange={(e) =>
                setPricingModel(
                  e.target.value as "PAY_PER_RUN" | "PAY_PER_RESULT",
                )
              }
            >
              <option value="PAY_PER_RUN">
                PAY_PER_RUN (Instant FeeSplit)
              </option>
              <option value="PAY_PER_RESULT">
                PAY_PER_RESULT (TaskEscrow per item)
              </option>
            </select>
          </div>

          <div className="form-field">
            <label htmlFor="studio-price">
              Price (atomic fUSD, 1000 = 0.001 fUSD)
            </label>
            <input
              id="studio-price"
              value={priceAtomic}
              onChange={(e) => setPriceAtomic(e.target.value)}
              pattern="^[0-9]+$"
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="studio-payto">
              Creator Wallet payTo (optional)
            </label>
            <input
              id="studio-payto"
              value={payTo}
              onChange={(e) => setPayTo(e.target.value)}
              placeholder="0x... (defaults to provider or demo address)"
            />
          </div>

          {mode === "agent" ? (
            <>
              <div className="form-field">
                <label htmlFor="studio-erc8004-id">
                  ERC-8004 Identity Token ID (Fuji)
                </label>
                <input
                  id="studio-erc8004-id"
                  value={erc8004TokenId}
                  onChange={(e) => setErc8004TokenId(e.target.value)}
                  pattern="^[0-9]+$"
                  required
                />
              </div>
              <div className="form-field">
                <label htmlFor="studio-task-kind">A2A Task Kind</label>
                <input
                  id="studio-task-kind"
                  value={taskKind}
                  onChange={(e) => setTaskKind(e.target.value)}
                  required
                />
              </div>
            </>
          ) : null}
        </div>

        <div className="form-field">
          <label htmlFor="studio-description">Description</label>
          <input
            id="studio-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="studio-code-split">
          <div className="form-field">
            <label htmlFor="studio-schema">
              Minimal Input Schema (JSON Schema 2020-12)
            </label>
            <textarea
              id="studio-schema"
              value={inputSchemaText}
              onChange={(e) => setInputSchemaText(e.target.value)}
              rows={10}
              spellCheck={false}
              required
            />
          </div>

          {mode === "actor" ? (
            <div className="form-field">
              <label htmlFor="studio-code">
                Actor JavaScript Code (ESM: export default async function
                run(input))
              </label>
              <textarea
                id="studio-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                rows={10}
                spellCheck={false}
                required
              />
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="error-banner" role="alert">
            <strong>Publish error</strong>
            <p>{error}</p>
          </div>
        ) : null}

        {published ? (
          <div className="published-banner" role="status">
            <div>
              <strong>
                Published {published.facetType}: {published.slug}
              </strong>
              <p>{published.detail}</p>
            </div>
            <a
              className="button button-primary"
              href={`/facets/${published.id}`}
            >
              Open &amp; Run in Playground <span aria-hidden="true">↗</span>
            </a>
          </div>
        ) : null}

        <button
          type="submit"
          className="button button-primary"
          disabled={submitting || !providerId}
        >
          {submitting
            ? "Publishing…"
            : mode === "actor"
              ? "Publish Docker Actor"
              : "Register ERC-8004 A2A Agent"}
          <span aria-hidden="true">↗</span>
        </button>
      </form>
    </div>
  );
}
