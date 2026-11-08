"use client";

import { useRef } from "react";

export function PublishPreviewDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        className="button button-primary"
        type="button"
        onClick={() => dialogRef.current?.showModal()}
      >
        Publish a Facet
      </button>
      <dialog
        className="publish-dialog"
        ref={dialogRef}
        aria-labelledby="publish-dialog-title"
      >
        <div className="dialog-rule" aria-hidden="true" />
        <p className="eyebrow">Phase 1 / Provider flow</p>
        <h2 id="publish-dialog-title">Bring an existing API.</h2>
        <p>
          The first publishing flow accepts OpenAPI 3.0 or 3.1 by paste or
          upload. URL import will only be enabled behind the isolated fetcher.
        </p>
        <div className="dialog-actions">
          <button
            className="button button-secondary"
            type="button"
            onClick={() => dialogRef.current?.close()}
          >
            Close
          </button>
          <a
            className="button button-primary"
            href="#import-foundation"
            onClick={() => dialogRef.current?.close()}
          >
            View foundation
          </a>
        </div>
      </dialog>
    </>
  );
}
