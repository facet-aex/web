import {
  FUJI_CHAIN_ID,
  FUJI_CONTRACTS,
  atomicToFusdInput,
  parseFusdToAtomic,
} from "@/lib/facet-ui";
import type { PricingModel } from "@/lib/identifiers";
import type { PublicFacet } from "@/lib/public-catalog";

export const DEFAULT_MAX_DEPOSIT_ATOMIC = "10000000" as const;

export interface PricingOptionDraft {
  model: PricingModel;
  priceFusd: string;
  maxItemsCap?: number;
  isPrimary: boolean;
}

export interface CreatePricingOptionInput {
  model: PricingModel;
  priceAtomic: string;
  maxItemsCap?: number;
  isPrimary: boolean;
}

export interface NormalizedPricingOption {
  model: PricingModel;
  priceAtomic: string;
  maxItemsCap?: number;
  maxAmountAtomic: string;
  assetAddress: string;
  chainId: 43113;
  payTo: string;
  isPrimary: boolean;
}

export interface FacetPricingFieldsProps {
  options: PricingOptionDraft[];
  onChange: (next: PricingOptionDraft[]) => void;
  maxDepositAtomic?: string;
  allowPayPerResult?: boolean;
  payPerResultHint?: string;
  disabled?: boolean;
}

export function validatePricingDrafts(
  drafts: PricingOptionDraft[],
  maxDepositAtomic = DEFAULT_MAX_DEPOSIT_ATOMIC,
): string | null {
  if (drafts.length === 0) {
    return "Select at least one pricing option.";
  }
  if (drafts.length > 2) {
    return "At most two pricing options are supported per Facet.";
  }

  let depositCap: bigint;
  try {
    depositCap = BigInt(maxDepositAtomic);
  } catch {
    depositCap = BigInt(DEFAULT_MAX_DEPOSIT_ATOMIC);
  }

  const seenModels = new Set<PricingModel>();
  for (const draft of drafts) {
    if (seenModels.has(draft.model)) {
      return `Duplicate pricing model '${draft.model}' — each model must be unique.`;
    }
    seenModels.add(draft.model);

    const atomic = parseFusdToAtomic(draft.priceFusd);
    if (!atomic) {
      return `${draft.model} price must be a positive fUSD amount with up to 6 decimals.`;
    }

    if (draft.model === "PAY_PER_RESULT") {
      const cap = draft.maxItemsCap;
      if (
        cap === undefined ||
        !Number.isInteger(cap) ||
        cap < 1 ||
        cap > 1000
      ) {
        return "PAY_PER_RESULT requires an integer max items cap between 1 and 1000.";
      }
      const worstCaseAtomic = BigInt(atomic) * BigInt(cap);
      if (worstCaseAtomic > depositCap) {
        return `PAY_PER_RESULT worst-case deposit (${atomicToFusdInput(worstCaseAtomic.toString())} fUSD) cannot exceed the ${atomicToFusdInput(depositCap.toString())} fUSD escrow deposit cap.`;
      }
    }
  }

  return null;
}

export function toCreatePricingOptions(
  drafts: PricingOptionDraft[],
): CreatePricingOptionInput[] {
  const error = validatePricingDrafts(drafts);
  if (error) {
    throw new Error(error);
  }

  const hasExplicitPrimary = drafts.some((draft) => draft.isPrimary);

  return drafts.map((draft, index) => {
    const priceAtomic = parseFusdToAtomic(draft.priceFusd);
    if (!priceAtomic) {
      throw new Error(`Invalid fUSD price for ${draft.model}`);
    }
    const isPrimary = hasExplicitPrimary ? draft.isPrimary : index === 0;
    return {
      model: draft.model,
      priceAtomic,
      ...(draft.model === "PAY_PER_RESULT" && draft.maxItemsCap !== undefined
        ? { maxItemsCap: draft.maxItemsCap }
        : {}),
      isPrimary,
    };
  });
}

export function normalizePricingOptions(
  legacyPricing?: PublicFacet["pricing"],
  pricingOptions?: NormalizedPricingOption[],
): NormalizedPricingOption[] {
  if (pricingOptions && pricingOptions.length > 0) {
    const hasPrimary = pricingOptions.some((option) => option.isPrimary);
    return pricingOptions.map((option, index) => ({
      ...option,
      isPrimary: hasPrimary ? option.isPrimary : index === 0,
    }));
  }

  if (legacyPricing) {
    return [
      {
        model: legacyPricing.model,
        priceAtomic: legacyPricing.priceAtomic,
        maxAmountAtomic: legacyPricing.priceAtomic,
        assetAddress: legacyPricing.assetAddress || FUJI_CONTRACTS.fusd,
        chainId: legacyPricing.chainId || FUJI_CHAIN_ID,
        payTo: legacyPricing.payTo,
        isPrimary: true,
      },
    ];
  }

  return [];
}
