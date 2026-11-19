"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { ProviderSelectorBar } from "@/components/provider-selector-bar";
import {
  formatAtomicFusd,
  getCategoryLabel,
  getFacetTypeMeta,
  snowtraceTxUrl,
} from "@/lib/facet-ui";
import type { FacetType, PricingModel } from "@/lib/identifiers";
import { useAccountWorkspace } from "@/lib/use-account-workspace";

export type MyFacetStatus =
  | "REGISTRATION_PENDING"
  | "PUBLISHED"
  | "FAILED"
  | "DRAFT"
  | "VALID"
  | "DISABLED";

export interface MyFacetItem {
  provider: string;
  facetName: string;
  facetDisplayName: string;
  facetType: FacetType;
  version: string;
  category: string;
  visibility: "PRIVATE" | "PUBLIC" | "UNLISTED";
  status: MyFacetStatus;
  pricingModel: PricingModel;
  priceAtomic: string;
  registryVerified: boolean;
  registryTxHash: string | null;
  errorCode: string | null;
  createdAt: string;
  publishedAt: string | null;
}

type FilterTab = "ALL" | FacetType;

function formatUtcTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "—";
  return `${parsed.toISOString().slice(0, 16).replace("T", " ")} UTC`;
}

function statusPillLabel(status: MyFacetStatus): string {
  switch (status) {
    case "REGISTRATION_PENDING":
      return "PENDING ON-CHAIN";
    case "PUBLISHED":
      return "PUBLISHED";
    case "FAILED":
      return "FAILED";
    case "VALID":
      return "VALIDATED";
    case "DISABLED":
      return "DISABLED";
    case "DRAFT":
    default:
      return "DRAFT";
  }
}

function statusVariant(status: MyFacetStatus): string {
  switch (status) {
    case "REGISTRATION_PENDING":
      return "pending";
    case "PUBLISHED":
      return "published";
    case "FAILED":
      return "failed";
    case "VALID":
      return "valid";
    case "DISABLED":
    case "DRAFT":
    default:
      return "draft";
  }
}

export function MyFacetsView({
  publishableKey,
  initialSubmitted,
  initialStatus,
}: {
  publishableKey?: string | undefined;
  initialSubmitted?: string | undefined;
  initialStatus?: string | undefined;
  initialType?: string | undefined;
}) {
  const workspace = useAccountWorkspace();
  const [facets, setFacets] = useState<MyFacetItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<FilterTab>("ALL");
  const [dismissedNotice, setDismissedNotice] = useState(false);
  const [reloadTick, setReloadTick] = useState(0);

  const submittedItem = initialSubmitted
    ? facets.find(
        (item) =>
          `${item.provider}/${item.facetName}@${item.version}` ===
          initialSubmitted,
      )
    : undefined;

  const hasPendingItems = facets.some(
    (item) => item.status === "REGISTRATION_PENDING",
  );
  const submittedStillPending =
    initialStatus === "REGISTRATION_PENDING" &&
    (!submittedItem || submittedItem.status === "REGISTRATION_PENDING");
  const shouldPoll =
    Boolean(workspace.username) && (hasPendingItems || submittedStillPending);

  useEffect(() => {
    if (!workspace.username) {
      return;
    }

    const controller = new AbortController();
    let initialLoad = true;

    async function loadMine() {
      await Promise.resolve();
      if (controller.signal.aborted) return;
      if (initialLoad) {
        setLoading(true);
      }
      setError(null);
      try {
        let response = await fetch("/api/facet/facets/mine", {
          cache: "no-store",
          signal: controller.signal,
        });

        if (response.status === 404) {
          response = await fetch("/api/facet/actors/mine", {
            cache: "no-store",
            signal: controller.signal,
          });
          if (!response.ok) {
            throw new Error("Could not load your published Facets.");
          }
          const actorBody = (await response.json()) as {
            actors?: Array<{
              provider: string;
              facetName: string;
              facetDisplayName: string;
              version: string;
              status: "REGISTRATION_PENDING" | "PUBLISHED" | "FAILED";
              registryTxHash?: string | null;
            }>;
          };
          if (!controller.signal.aborted) {
            setFacets(
              (actorBody.actors ?? []).map((actor) => ({
                provider: actor.provider,
                facetName: actor.facetName,
                facetDisplayName: actor.facetDisplayName,
                facetType: "ACTOR",
                version: actor.version,
                category: "others",
                visibility: actor.status === "PUBLISHED" ? "PUBLIC" : "PRIVATE",
                status: actor.status,
                pricingModel: "PAY_PER_RUN",
                priceAtomic: "1000",
                registryVerified: actor.status === "PUBLISHED",
                registryTxHash: actor.registryTxHash ?? null,
                errorCode: null,
                createdAt: "",
                publishedAt: null,
              })),
            );
          }
          return;
        }

        if (!response.ok) {
          throw new Error("Could not load your Facets.");
        }
        const body = (await response.json()) as { facets?: MyFacetItem[] };
        if (!controller.signal.aborted) {
          setFacets(body.facets ?? []);
        }
      } catch (err) {
        if (controller.signal.aborted) return;
        setError(
          err instanceof Error ? err.message : "Could not load your Facets.",
        );
      } finally {
        initialLoad = false;
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadMine();

    const timer = shouldPoll
      ? window.setInterval(() => {
          void loadMine();
        }, 3000)
      : undefined;

    return () => {
      controller.abort();
      if (timer !== undefined) {
        window.clearInterval(timer);
      }
    };
  }, [workspace.username, reloadTick, shouldPoll]);

  const visibleSourceFacets = workspace.username ? facets : [];
  const counts = {
    ALL: visibleSourceFacets.length,
    ACTOR: visibleSourceFacets.filter((f) => f.facetType === "ACTOR").length,
    AGENT: visibleSourceFacets.filter((f) => f.facetType === "AGENT").length,
    API: visibleSourceFacets.filter((f) => f.facetType === "API").length,
  };
  const pendingCount = visibleSourceFacets.filter(
    (f) => f.status === "REGISTRATION_PENDING",
  ).length;
  const visibleFacets =
    filterType === "ALL"
      ? visibleSourceFacets
      : visibleSourceFacets.filter((item) => item.facetType === filterType);

  const noticeStatus: "REGISTRATION_PENDING" | "PUBLISHED" | "FAILED" =
    submittedItem?.status === "PUBLISHED" || submittedItem?.status === "FAILED"
      ? submittedItem.status
      : submittedItem?.status === "REGISTRATION_PENDING"
        ? "REGISTRATION_PENDING"
        : initialStatus === "PUBLISHED" || initialStatus === "FAILED"
          ? initialStatus
          : "REGISTRATION_PENDING";

  return (
    <div className="my-facets-page">
      <header className="studio-mode-header">
        <div>
          <div className="modality-pill-row">
            <span className="studio-mode-tag">ACCOUNT · FACET MANAGEMENT</span>
          </div>
          <h1>My Facets</h1>
          <p>
            Track publish history, Avalanche Fuji registration status, and
            pricing across all Capabilities owned by your account.
          </p>
        </div>
        <div className="provider-bar-actions">
          <Link href="/studio" className="button button-primary">
            + Publish New Facet <span aria-hidden="true">↗</span>
          </Link>
        </div>
      </header>

      <ProviderSelectorBar
        workspace={workspace}
        publishableKey={publishableKey}
      />

      {initialSubmitted && !dismissedNotice ? (
        <div
          className="my-facets-notice"
          data-status={noticeStatus}
          role="status"
          aria-live="polite"
        >
          <div className="my-facets-notice-copy">
            <span className="eyebrow">
              {noticeStatus === "REGISTRATION_PENDING"
                ? "ON-CHAIN REGISTRATION PENDING"
                : noticeStatus === "FAILED"
                  ? "ON-CHAIN REGISTRATION FAILED"
                  : "PUBLISHED"}
            </span>
            <strong>
              {noticeStatus === "REGISTRATION_PENDING"
                ? "Publish request submitted — Registration Pending"
                : noticeStatus === "FAILED"
                  ? "On-chain registration failed"
                  : "On-chain registration confirmed — Published ✓"}
            </strong>
            <p>
              {noticeStatus === "REGISTRATION_PENDING"
                ? `${initialSubmitted} is queued for Avalanche Fuji registry confirmation. This list refreshes automatically until confirmed.`
                : noticeStatus === "FAILED"
                  ? `${initialSubmitted} failed on-chain registration${submittedItem?.errorCode ? ` (${submittedItem.errorCode})` : ""}.`
                  : `${initialSubmitted} is verified and live in the public Store.`}
            </p>
          </div>
          <div className="my-facets-notice-actions">
            {noticeStatus === "PUBLISHED" && submittedItem ? (
              <Link
                href={`/facets/${encodeURIComponent(submittedItem.provider)}/${encodeURIComponent(submittedItem.facetName)}`}
                className="button button-primary"
              >
                Open Playground <span aria-hidden="true">↗</span>
              </Link>
            ) : null}
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setDismissedNotice(true)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}

      <div className="my-facets-toolbar">
        <div className="studio-tabs" role="tablist" aria-label="Filter by type">
          {(
            [
              ["ALL", `All (${counts.ALL})`],
              ["ACTOR", `Actor (${counts.ACTOR})`],
              ["AGENT", `Agent (${counts.AGENT})`],
              ["API", `API (${counts.API})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filterType === key}
              className={`tab-button ${filterType === key ? "tab-active" : ""}`}
              onClick={() => setFilterType(key)}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="my-facets-toolbar-right">
          {pendingCount > 0 ? (
            <span className="my-facet-status my-facet-status-pending">
              <span className="my-facet-status-dot" aria-hidden="true" />
              {pendingCount} pending confirmation
            </span>
          ) : null}
          <button
            type="button"
            className="button button-secondary"
            disabled={loading || !workspace.username}
            onClick={() => setReloadTick((prev) => prev + 1)}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error ? (
        <div className="error-banner" role="alert">
          <strong>Could not load Facets</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {workspace.authRequired ? (
        <div className="empty-catalog">
          <p>Sign in with your FACET account to view your published Facets.</p>
        </div>
      ) : visibleFacets.length === 0 ? (
        <div className="empty-catalog">
          <p>
            {loading
              ? "Loading your published Facets…"
              : "No Facets published under this account yet."}
          </p>
          {!loading ? (
            <div className="empty-catalog-actions">
              <Link href="/studio" className="button button-primary">
                Open Studio <span aria-hidden="true">↗</span>
              </Link>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="my-facets-list" role="region" aria-label="Your Facets">
          {visibleFacets.map((item) => {
            const meta = getFacetTypeMeta(item.facetType);
            const id = `${item.provider}/${item.facetName}@${item.version}`;
            const variant = statusVariant(item.status);
            const unit =
              item.pricingModel === "PAY_PER_RESULT" ? "item" : "run";
            const timestamp = formatUtcTimestamp(
              item.publishedAt ?? item.createdAt,
            );

            return (
              <article
                key={id}
                className={`my-facet-row ${initialSubmitted === id ? "my-facet-row-highlighted" : ""}`}
              >
                <span className={`badge-type badge-${meta.accentClass}`}>
                  {meta.glyph} {meta.badge}
                </span>

                <div className="my-facet-main">
                  <strong>{item.facetDisplayName}</strong>
                  <div className="my-facet-sub">
                    <code>{id}</code>
                    <span className="kicker-chip">
                      {getCategoryLabel(item.category, item.facetType)}
                    </span>
                    {item.errorCode ? (
                      <span className="field-warning">{item.errorCode}</span>
                    ) : null}
                  </div>
                </div>

                <span className={`my-facet-status my-facet-status-${variant}`}>
                  <span className="my-facet-status-dot" aria-hidden="true" />
                  {statusPillLabel(item.status)}
                </span>

                <div className="my-facet-pricing">
                  <span>{item.pricingModel}</span>
                  <strong>
                    {formatAtomicFusd(item.priceAtomic)} / {unit}
                  </strong>
                </div>

                <div className="my-facet-time">{timestamp}</div>

                <div className="my-facet-actions">
                  {item.status === "PUBLISHED" ? (
                    <Link
                      href={`/facets/${encodeURIComponent(item.provider)}/${encodeURIComponent(item.facetName)}`}
                      className="button button-primary"
                    >
                      Open Playground <span aria-hidden="true">↗</span>
                    </Link>
                  ) : item.status === "REGISTRATION_PENDING" ? (
                    <span className="mono-detail">Registering on Fuji…</span>
                  ) : null}
                  {item.registryTxHash ? (
                    <a
                      href={snowtraceTxUrl(item.registryTxHash)}
                      target="_blank"
                      rel="noreferrer"
                      className="explorer-link"
                    >
                      Fuji Tx ↗
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
