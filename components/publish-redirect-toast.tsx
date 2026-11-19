"use client";

import Link from "next/link";

export type PublishSubmissionStatus =
  "REGISTRATION_PENDING" | "PUBLISHED" | "FAILED";

export function buildMyFacetsRedirectHref(params: {
  provider: string;
  facetName: string;
  version: string;
  status: PublishSubmissionStatus;
  facetType: "ACTOR" | "AGENT" | "API";
}): string {
  const query = new URLSearchParams({
    submitted: `${params.provider}/${params.facetName}@${params.version}`,
    status: params.status,
    type: params.facetType,
  });
  return `/my-facets?${query.toString()}`;
}

export function PublishRedirectToast({
  identifier,
  facetType,
  status,
  targetHref,
  redirecting = false,
  onDismiss,
}: {
  identifier: string;
  facetType: "ACTOR" | "AGENT" | "API";
  status: PublishSubmissionStatus;
  targetHref: string;
  redirecting?: boolean | undefined;
  onDismiss?: (() => void) | undefined;
}) {
  const isPending = status === "REGISTRATION_PENDING";
  const isFailed = status === "FAILED";

  const eyebrow = isPending
    ? "ON-CHAIN PUBLISH SUBMITTED · PENDING"
    : isFailed
      ? "ON-CHAIN REGISTRATION FAILED"
      : `${facetType} PUBLISHED`;

  const heading = isPending
    ? "Publish request sent — Registration Pending"
    : isFailed
      ? "Publish failed on Fuji"
      : "Published successfully";

  const message = isPending
    ? `${identifier} has been submitted for on-chain registration on Avalanche Fuji.${redirecting ? " Redirecting to My Facets…" : ""}`
    : isFailed
      ? `${identifier} encountered an on-chain registration error.${redirecting ? " Redirecting to My Facets…" : ""}`
      : `${identifier} is now published.${redirecting ? " Redirecting to My Facets…" : ""}`;

  return (
    <div
      className="publish-toast"
      data-status={status}
      role="status"
      aria-live="polite"
    >
      <div className="publish-toast-copy">
        <span className="eyebrow">{eyebrow}</span>
        <strong>{heading}</strong>
        <p>{message}</p>
      </div>
      <div className="publish-toast-actions">
        <Link href={targetHref} className="button button-primary">
          Go to My Facets <span aria-hidden="true">↗</span>
        </Link>
        {onDismiss ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={onDismiss}
          >
            Dismiss
          </button>
        ) : null}
      </div>
    </div>
  );
}
