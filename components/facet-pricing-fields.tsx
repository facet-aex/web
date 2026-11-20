"use client";

import { useId } from "react";

import {
  atomicToFusdInput,
  formatAtomicFusd,
  parseFusdToAtomic,
} from "@/lib/facet-ui";
import type { PricingModel } from "@/lib/identifiers";
import {
  DEFAULT_MAX_DEPOSIT_ATOMIC,
  validatePricingDrafts,
  type FacetPricingFieldsProps,
  type PricingOptionDraft,
} from "@/lib/pricing-types";

const QUICK_PRICE_PRESETS = ["0.001", "0.005", "0.01", "0.05"] as const;
const QUICK_ITEM_PRICE_PRESETS = [
  "0.0001",
  "0.0005",
  "0.001",
  "0.005",
] as const;

export interface LegacyFacetPricingFieldsProps {
  idPrefix: string;
  pricingModel: "PAY_PER_RUN";
  priceFusdText: string;
  onPriceFusdChange?: ((next: string) => void) | undefined;
  disabled?: boolean | undefined;
  priceReadOnly?: boolean | undefined;
}

export type MultiFacetPricingFieldsProps = FacetPricingFieldsProps & {
  idPrefix?: string | undefined;
};

function sortPricingOptions(
  options: PricingOptionDraft[],
): PricingOptionDraft[] {
  const order: Record<PricingModel, number> = {
    PAY_PER_RUN: 0,
    PAY_PER_RESULT: 1,
  };
  return [...options].sort((a, b) => order[a.model] - order[b.model]);
}

function LegacyFacetPricingFields({
  idPrefix,
  pricingModel,
  priceFusdText,
  onPriceFusdChange,
  disabled = false,
  priceReadOnly = false,
}: LegacyFacetPricingFieldsProps) {
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
      </fieldset>

      <div className="form-field">
        <label htmlFor={`${idPrefix}-price-fusd`}>
          Price per run (fUSD on Avalanche)
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
      </div>
    </div>
  );
}

export function FacetPricingFields(
  props: MultiFacetPricingFieldsProps | LegacyFacetPricingFieldsProps,
) {
  const generatedId = useId();

  if (!("options" in props)) {
    return <LegacyFacetPricingFields {...props} />;
  }

  const {
    options,
    onChange,
    maxDepositAtomic = DEFAULT_MAX_DEPOSIT_ATOMIC,
    allowPayPerResult = true,
    payPerResultHint,
    disabled = false,
  } = props;
  const idPrefix = props.idPrefix ?? `facet-pricing-${generatedId}`;

  const payPerRunOption = options.find((opt) => opt.model === "PAY_PER_RUN");
  const payPerResultOption = options.find(
    (opt) => opt.model === "PAY_PER_RESULT",
  );
  const primaryModel =
    options.find((opt) => opt.isPrimary)?.model ??
    options[0]?.model ??
    "PAY_PER_RUN";
  const validationError =
    maxDepositAtomic === DEFAULT_MAX_DEPOSIT_ATOMIC
      ? validatePricingDrafts(options)
      : validatePricingDrafts(
          options,
          maxDepositAtomic as typeof DEFAULT_MAX_DEPOSIT_ATOMIC,
        );

  function toggleModel(model: PricingModel, checked: boolean) {
    if (checked) {
      if (options.some((opt) => opt.model === model)) return;
      const nextOption: PricingOptionDraft =
        model === "PAY_PER_RESULT"
          ? {
              model: "PAY_PER_RESULT",
              priceFusd: "0.0005",
              maxItemsCap: 20,
              isPrimary: options.length === 0,
            }
          : {
              model: "PAY_PER_RUN",
              priceFusd: "0.001",
              isPrimary: options.length === 0,
            };
      onChange(sortPricingOptions([...options, nextOption]));
      return;
    }

    if (options.length <= 1) return;
    const remaining = options.filter((opt) => opt.model !== model);
    if (remaining.length > 0 && !remaining.some((opt) => opt.isPrimary)) {
      remaining[0] = { ...remaining[0]!, isPrimary: true };
    }
    onChange(sortPricingOptions(remaining));
  }

  function updateOption(
    model: PricingModel,
    patch: Partial<PricingOptionDraft>,
  ) {
    onChange(
      options.map((opt) => (opt.model === model ? { ...opt, ...patch } : opt)),
    );
  }

  function selectPrimary(model: PricingModel) {
    onChange(
      options.map((opt) => ({
        ...opt,
        isPrimary: opt.model === model,
      })),
    );
  }

  const payPerRunAtomic = payPerRunOption
    ? parseFusdToAtomic(payPerRunOption.priceFusd)
    : null;
  const payPerResultAtomic = payPerResultOption
    ? parseFusdToAtomic(payPerResultOption.priceFusd)
    : null;
  const payPerResultCap = payPerResultOption?.maxItemsCap;
  const payPerResultMaxDepositAtomic =
    payPerResultAtomic &&
    payPerResultCap !== undefined &&
    Number.isInteger(payPerResultCap) &&
    payPerResultCap >= 1 &&
    payPerResultCap <= 1000
      ? (BigInt(payPerResultAtomic) * BigInt(payPerResultCap)).toString()
      : null;

  return (
    <div className="facet-pricing-fields">
      <div className="pricing-option-grid">
        <div
          className={`pricing-option-card ${payPerRunOption ? "pricing-option-card-active" : ""}`}
        >
          <label
            className="pricing-option-check-row"
            htmlFor={`${idPrefix}-toggle-pay-per-run`}
          >
            <input
              id={`${idPrefix}-toggle-pay-per-run`}
              type="checkbox"
              value="PAY_PER_RUN"
              checked={Boolean(payPerRunOption)}
              disabled={
                disabled || (Boolean(payPerRunOption) && options.length <= 1)
              }
              onChange={(event) =>
                toggleModel("PAY_PER_RUN", event.target.checked)
              }
            />
            <span className="pricing-option-title">
              <strong>Pay per run</strong>
              <small>
                Fixed x402 fee per execution (95% provider / 5% protocol).
              </small>
            </span>
          </label>

          {payPerRunOption ? (
            <div className="pricing-option-fields">
              <div className="form-field">
                <label htmlFor={`${idPrefix}-pay-per-run-price`}>
                  Price per run (fUSD on Avalanche)
                </label>
                <div className="pricing-fusd-row">
                  <input
                    id={`${idPrefix}-pay-per-run-price`}
                    inputMode="decimal"
                    value={payPerRunOption.priceFusd}
                    disabled={disabled}
                    placeholder="0.001"
                    onChange={(event) =>
                      updateOption("PAY_PER_RUN", {
                        priceFusd: event.target.value,
                      })
                    }
                  />
                  <div
                    className="pricing-presets"
                    aria-label="Quick Pay per run fUSD price presets"
                  >
                    {QUICK_PRICE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-chip ${payPerRunOption.priceFusd.trim() === preset ? "preset-chip-active" : ""}`}
                        disabled={disabled}
                        onClick={() =>
                          updateOption("PAY_PER_RUN", { priceFusd: preset })
                        }
                      >
                        {preset} fUSD
                      </button>
                    ))}
                  </div>
                </div>
                {payPerRunAtomic ? (
                  <small className="mono-detail">
                    = {Number(payPerRunAtomic).toLocaleString("en-US")} atomic
                    fUSD ({formatAtomicFusd(payPerRunAtomic)})
                  </small>
                ) : (
                  <small className="field-warning">
                    Enter a positive fUSD amount with up to 6 decimals.
                  </small>
                )}
              </div>
            </div>
          ) : null}
        </div>

        <div
          className={`pricing-option-card ${payPerResultOption ? "pricing-option-card-active" : ""} ${!allowPayPerResult ? "pricing-option-card-disabled" : ""}`}
        >
          <label
            className="pricing-option-check-row"
            htmlFor={`${idPrefix}-toggle-pay-per-result`}
          >
            <input
              id={`${idPrefix}-toggle-pay-per-result`}
              type="checkbox"
              value="PAY_PER_RESULT"
              checked={Boolean(payPerResultOption)}
              disabled={
                disabled ||
                !allowPayPerResult ||
                (Boolean(payPerResultOption) && options.length <= 1)
              }
              onChange={(event) =>
                toggleModel("PAY_PER_RESULT", event.target.checked)
              }
            />
            <span className="pricing-option-title">
              <strong>Pay per result</strong>
              <small>
                Escrow metered per returned Dataset item with automatic buyer
                refund for unused items.
              </small>
            </span>
          </label>

          {!allowPayPerResult || payPerResultHint ? (
            <small className="pricing-option-hint">
              {payPerResultHint ??
                "Configure structured Dataset output to enable Pay per result."}
            </small>
          ) : null}

          {payPerResultOption ? (
            <div className="pricing-option-fields">
              <div className="form-field">
                <label htmlFor={`${idPrefix}-pay-per-result-price`}>
                  Price per item (fUSD on Avalanche)
                </label>
                <div className="pricing-fusd-row">
                  <input
                    id={`${idPrefix}-pay-per-result-price`}
                    inputMode="decimal"
                    value={payPerResultOption.priceFusd}
                    disabled={disabled}
                    placeholder="0.0005"
                    onChange={(event) =>
                      updateOption("PAY_PER_RESULT", {
                        priceFusd: event.target.value,
                      })
                    }
                  />
                  <div
                    className="pricing-presets"
                    aria-label="Quick Pay per result fUSD price presets"
                  >
                    {QUICK_ITEM_PRICE_PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        className={`preset-chip ${payPerResultOption.priceFusd.trim() === preset ? "preset-chip-active" : ""}`}
                        disabled={disabled}
                        onClick={() =>
                          updateOption("PAY_PER_RESULT", { priceFusd: preset })
                        }
                      >
                        {preset} fUSD
                      </button>
                    ))}
                  </div>
                </div>
                {payPerResultAtomic ? (
                  <small className="mono-detail">
                    = {Number(payPerResultAtomic).toLocaleString("en-US")}{" "}
                    atomic fUSD / item
                  </small>
                ) : (
                  <small className="field-warning">
                    Enter a positive fUSD amount with up to 6 decimals.
                  </small>
                )}
              </div>

              <div className="form-field">
                <label htmlFor={`${idPrefix}-max-items-cap`}>
                  Max items cap (1–1000)
                </label>
                <input
                  id={`${idPrefix}-max-items-cap`}
                  type="number"
                  min={1}
                  max={1000}
                  step={1}
                  value={
                    payPerResultOption.maxItemsCap !== undefined
                      ? String(payPerResultOption.maxItemsCap)
                      : ""
                  }
                  disabled={disabled}
                  onChange={(event) => {
                    const raw = event.target.value.trim();
                    if (raw === "") {
                      onChange(
                        options.map((opt) =>
                          opt.model === "PAY_PER_RESULT"
                            ? {
                                model: opt.model,
                                priceFusd: opt.priceFusd,
                                isPrimary: opt.isPrimary,
                              }
                            : opt,
                        ),
                      );
                      return;
                    }
                    const parsed = Number.parseInt(raw, 10);
                    updateOption("PAY_PER_RESULT", {
                      maxItemsCap: Number.isNaN(parsed) ? 0 : parsed,
                    });
                  }}
                />
              </div>

              {payPerResultMaxDepositAtomic ? (
                <div className="pricing-option-deposit">
                  <span>Max escrow deposit:</span>
                  <strong>
                    {formatAtomicFusd(payPerResultMaxDepositAtomic)}
                  </strong>
                  <small>
                    (protocol cap {atomicToFusdInput(maxDepositAtomic)} fUSD)
                  </small>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      {options.length > 0 ? (
        <fieldset className="pricing-primary-selector">
          <legend>Primary on-chain pricing option</legend>
          <div className="pricing-primary-options">
            {options.map((option) => (
              <label
                key={option.model}
                className={`pricing-primary-pill ${primaryModel === option.model ? "pricing-primary-pill-active" : ""}`}
              >
                <input
                  type="radio"
                  name={`${idPrefix}-primary-model`}
                  value={option.model}
                  checked={primaryModel === option.model}
                  disabled={disabled}
                  onChange={() => selectPrimary(option.model)}
                />
                <span>{option.model}</span>
                {primaryModel === option.model ? <small>Primary</small> : null}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}

      {validationError ? (
        <small className="field-warning" role="alert">
          {validationError}
        </small>
      ) : null}
    </div>
  );
}
