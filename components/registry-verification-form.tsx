"use client";

import { useState, type FormEvent } from "react";

interface RegistryVerificationFormProps {
  facetId: string;
  initialTxHash?: string;
}

export function RegistryVerificationForm({
  facetId,
  initialTxHash = "",
}: RegistryVerificationFormProps) {
  const [txHash, setTxHash] = useState(initialTxHash);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const registryTxHash = txHash.trim();
    if (!/^0x[a-f\d]{64}$/iu.test(registryTxHash)) {
      setError("Enter a valid 0x 64-hex Fuji transaction hash.");
      return;
    }

    setVerifying(true);
    try {
      const response = await fetch(
        `/api/facet/facets/${encodeURIComponent(facetId)}/verify-registry`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ registryTxHash }),
        },
      );
      const body = (await response.json().catch(() => null)) as {
        registryVerified?: boolean;
        error?: { message?: string };
      } | null;
      if (!response.ok || !body?.registryVerified) {
        throw new Error(
          body?.error?.message ?? "Fuji registry verification failed.",
        );
      }
      window.location.reload();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Verification failed.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <form
      className="verify-tx-box"
      onSubmit={(event) => void handleVerify(event)}
    >
      <label htmlFor="registry-verify-tx">
        Verify Fuji registry transaction
      </label>
      <p>
        Published this Facet? Enter its FacetActorRegistry transaction hash.
      </p>
      <div className="verify-tx-row">
        <input
          id="registry-verify-tx"
          name="registryTxHash"
          value={txHash}
          onChange={(event) => setTxHash(event.target.value)}
          placeholder="0x... Fuji tx hash"
          autoComplete="off"
          required
        />
        <button
          className="button button-secondary"
          type="submit"
          disabled={verifying || !txHash.trim()}
        >
          {verifying ? "Verifying…" : "Verify"}
        </button>
      </div>
      {error ? (
        <small className="field-warning" role="alert">
          {error}
        </small>
      ) : null}
    </form>
  );
}
