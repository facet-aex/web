"use client";

import { formatAtomicFusd, parseFusdToAtomic } from "@/lib/facet-ui";

const QUICK_PRICE_PRESETS = ["0.001", "0.005", "0.01", "0.05"] as const;

export function FacetPricingFields({
  idPrefix,
  pricingModel,
  priceFusdText,
  onPriceFusdChange,
  disabled = false,
  priceReadOnly = false,
}: {
  idPrefix: string;
  pricingModel: "PAY_PER_RUN";
  priceFusdText: string;
  onPriceFusdChange?: ((next: string) => void) | undefined;
  disabled?: boolean | undefined;
  priceReadOnly?: boolean | undefined;
}) {
  const atomic = parseFusdToAtomic(priceFusdText);

  return (
    <div className="facet-pricing-fields">
      <fieldset className="pricing-mode-cards">
        <legend>Payment Model</legend>

        <label className="pricing-card">
          <input
            type="radio"
            name={`${idPrefix}-pricing-model`}
            value="PAY_PER_RUN"
            checked={pricingModel === "PAY_PER_RUN"}
            onChange={() => {}}
            disabled={disabled}
          />
          <span>
            <strong>Pay per run</strong>
            <small>
              Fixed x402 price per execution (95% provider / 5% protocol).
            </small>
          </span>
        </label>

        <label className="pricing-card pricing-card-disabled">
          <input
            type="radio"
            name={`${idPrefix}-pricing-model`}
            value="PAY_PER_RESULT"
            disabled
          />
          <span>
            <span className="pricing-card-head">
              <strong>Pay per result</strong>
              <span className="pricing-soon-badge">COMING SOON</span>
            </span>
            <small>Escrow charge metered per returned Dataset item.</small>
          </span>
        </label>

        <label className="pricing-card pricing-card-disabled">
          <input
            type="radio"
            name={`${idPrefix}-pricing-model`}
            value="PAY_PER_EVENT"
            disabled
          />
          <span>
            <span className="pricing-card-head">
              <strong>Pay per event</strong>
              <span className="pricing-soon-badge">COMING SOON</span>
            </span>
            <small>Metered charge per custom runtime event emitted.</small>
          </span>
        </label>
      </fieldset>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-price-fusd`}>
          Price per run (fUSD on Avalanche Fuji)
        </label>
        <div className="pricing-fusd-row">
          <input
            id={`${idPrefix}-price-fusd`}
            inputMode="decimal"
            value={priceFusdText}
            readOnly={priceReadOnly}
            disabled={disabled}
            placeholder="0.001"
            onChange={(event) => onPriceFusdChange?.(event.target.value)}
          />
          {!priceReadOnly ? (
            <div
              className="pricing-presets"
              aria-label="Quick fUSD price presets"
            >
              {QUICK_PRICE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={`preset-chip ${priceFusdText.trim() === preset ? "preset-chip-active" : ""}`}
                  disabled={disabled}
                  onClick={() => onPriceFusdChange?.(preset)}
                >
                  {preset} fUSD
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {atomic ? (
          <small className="mono-detail">
            = {Number(atomic).toLocaleString("en-US")} atomic fUSD (
            {formatAtomicFusd(atomic)})
          </small>
        ) : (
          <small className="field-warning">
            Enter a positive fUSD amount with up to 6 decimals (for example,
            0.001).
          </small>
        )}
        <small>
          Browser demo payer sponsors 0.001 fUSD runs; buyer wallets (CLI/MCP)
          pay any configured price.
        </small>
      </div>
    </div>
  );
}
