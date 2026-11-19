import { suggestFacetName, type FacetType } from "@/lib/identifiers";

export const FUJI_CHAIN_ID = 43113 as const;

export const ERC8004_IDENTITY_REGISTRY =
  "0x8004A818BFB912233c491871b3d84c89A494BD9e";

export const ERC8004_REPUTATION_REGISTRY =
  "0x8004B663056A597Dffe9eCcC1965A193B7388713";

export const FUJI_CONTRACTS = {
  fusd: "0xe7082a54a456dc4dfe0ceadcd0d0dce7d8ba176f",
  actorRegistry: "0xc37c12bcd53a4ba5fd33870cecc74a4ba601e3a2",
  feeSplitAndEscrow: "0xc50cb5d5ff6c71eb1b065971c198a9edb0ecff06",
  receiptLog: "0x5dc611b5642c306dd50fa7f786194dc04bd12fa7",
} as const;

export interface FacetTypeMeta {
  type: FacetType;
  badge: string;
  shortLabel: string;
  fullLabel: string;
  facetTag: string;
  accentClass: "modality-api" | "modality-actor" | "modality-agent";
  glyph: string;
  actionLabel: string;
  storeHref: string;
  studioHref: string;
  description: string;
}

export const FACET_TYPE_META: Record<FacetType, FacetTypeMeta> = {
  API: {
    type: "API",
    badge: "API",
    shortLabel: "API",
    fullLabel: "API",
    facetTag: "Facet · API",
    accentClass: "modality-api",
    glyph: "⇄",
    actionLabel: "Inspect API",
    storeHref: "/store?type=API",
    studioHref: "/studio/api",
    description:
      "REST endpoints and OpenAPI specs packaged as a Facet with Gateway SSRF pinning, encrypted upstream secrets, and x402 billing.",
  },
  ACTOR: {
    type: "ACTOR",
    badge: "ACTOR",
    shortLabel: "Actor",
    fullLabel: "Actor",
    facetTag: "Facet · Actor",
    accentClass: "modality-actor",
    glyph: "▣",
    actionLabel: "Run Actor",
    storeHref: "/store?type=ACTOR",
    studioHref: "/studio/actor",
    description:
      "Isolated Node.js 22 Docker modules packaged as a Facet returning structured Datasets with deterministic on-chain imageDigest verification.",
  },
  AGENT: {
    type: "AGENT",
    badge: "AGENT",
    shortLabel: "Agent",
    fullLabel: "Agent",
    facetTag: "Facet · Agent",
    accentClass: "modality-agent",
    glyph: "◈",
    actionLabel: "Delegate to Agent",
    storeHref: "/store?type=AGENT",
    studioHref: "/studio/agent",
    description:
      "On-chain Agent identity on Avalanche Fuji packaged as a Facet with verifiable task contracts, citations, and settlement.",
  },
};

export function getFacetTypeMeta(facetType?: FacetType): FacetTypeMeta {
  if (facetType && facetType in FACET_TYPE_META) {
    return FACET_TYPE_META[facetType];
  }
  return FACET_TYPE_META.API;
}

export interface CategoryFilterOption {
  slug: string;
  label: string;
}

export const STORE_CATEGORY_FILTERS: Record<
  FacetType | "ALL",
  CategoryFilterOption[]
> = {
  ALL: [
    { slug: "", label: "All Categories" },
    { slug: "data", label: "Data" },
    { slug: "social", label: "Social" },
    { slug: "web-scraping", label: "Web Scraping" },
    { slug: "vietnamese-data", label: "Vietnamese Data" },
    { slug: "a2a-agents", label: "Multi-Task" },
  ],
  API: [
    { slug: "", label: "All" },
    { slug: "data", label: "Data" },
    { slug: "social", label: "Social" },
    { slug: "finance", label: "Finance & Crypto" },
    { slug: "ai", label: "AI & Search" },
    { slug: "developer-tools", label: "Developer Tools" },
  ],
  ACTOR: [
    { slug: "", label: "All" },
    { slug: "web-scraping", label: "Web Scraping" },
    { slug: "vietnamese-data", label: "Vietnamese Data" },
    { slug: "data-processing", label: "Data Processing" },
    { slug: "ecommerce", label: "E-commerce" },
    { slug: "social", label: "Social & News" },
  ],
  AGENT: [
    { slug: "", label: "All" },
    { slug: "a2a-agents", label: "Multi-Task" },
    { slug: "market-analysis", label: "Market Analysis" },
    { slug: "research", label: "Research" },
    { slug: "defi", label: "DeFi & Trading" },
    { slug: "automation", label: "Workflow Automation" },
  ],
};

export function getStoreCategoriesForType(
  facetType?: FacetType | "",
): CategoryFilterOption[] {
  if (facetType && facetType in STORE_CATEGORY_FILTERS) {
    return STORE_CATEGORY_FILTERS[facetType];
  }
  return STORE_CATEGORY_FILTERS.ALL;
}

export const FACET_CATEGORY_OPTIONS: CategoryFilterOption[] = [
  { slug: "ai", label: "AI & Agents" },
  { slug: "automation", label: "Automation & Workflows" },
  { slug: "business", label: "Business & B2B" },
  { slug: "data", label: "Data & Analytics" },
  { slug: "data-processing", label: "Data Processing & ETL" },
  { slug: "developer-tools", label: "Developer Tools" },
  { slug: "ecommerce", label: "E-commerce & Retail" },
  { slug: "finance", label: "Finance, Crypto & DeFi" },
  { slug: "jobs", label: "Jobs & Recruiting" },
  { slug: "lead-generation", label: "Lead Generation" },
  { slug: "maps-travel", label: "Maps & Travel" },
  { slug: "market-analysis", label: "Market Analysis" },
  { slug: "marketing", label: "Marketing & Growth" },
  { slug: "news", label: "News & Media" },
  { slug: "real-estate", label: "Real Estate" },
  { slug: "research", label: "Research & Science" },
  { slug: "seo", label: "SEO Tools" },
  { slug: "social", label: "Social Media" },
  { slug: "vietnamese-data", label: "Vietnamese Data" },
  { slug: "web-scraping", label: "Web Scraping" },
  { slug: "a2a-agents", label: "Autonomous Multi-Task" },
  { slug: "api", label: "API & Integrations" },
  { slug: "other", label: "Other" },
];

export function getCategoryLabel(slug: string): string {
  const normalized = slug.trim();
  const match = FACET_CATEGORY_OPTIONS.find(
    (option) => option.slug === normalized,
  );
  return match ? match.label : normalized || "Uncategorized";
}

export function getCategoryOptionsWithCurrent(
  currentSlug: string,
): CategoryFilterOption[] {
  const trimmed = currentSlug.trim();
  if (
    !trimmed ||
    FACET_CATEGORY_OPTIONS.some((option) => option.slug === trimmed)
  ) {
    return FACET_CATEGORY_OPTIONS;
  }
  return [...FACET_CATEGORY_OPTIONS, { slug: trimmed, label: trimmed }];
}

const MAX_PRICE_ATOMIC_STR = "1000000000000";

export function parseFusdToAtomic(input: string): string | null {
  const trimmed = input.trim();
  if (!/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,6})?$/u.test(trimmed)) {
    return null;
  }
  const [whole = "0", frac = ""] = trimmed.split(".");
  const rawDigits = `${whole}${frac.padEnd(6, "0")}`;
  const normalized = rawDigits.replace(/^0+/u, "") || "0";
  if (
    normalized === "0" ||
    normalized.length > MAX_PRICE_ATOMIC_STR.length ||
    (normalized.length === MAX_PRICE_ATOMIC_STR.length &&
      normalized > MAX_PRICE_ATOMIC_STR)
  ) {
    return null;
  }
  return normalized;
}

export function atomicToFusdInput(atomic: string): string {
  const trimmed = atomic.trim();
  if (!trimmed || !/^[0-9]+$/u.test(trimmed)) return "0.001";
  const normalized = trimmed.replace(/^0+/u, "") || "0";
  if (normalized === "0") return "0";
  const padded = normalized.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const frac = padded.slice(-6).replace(/0+$/u, "");
  return frac ? `${whole}.${frac}` : whole;
}

export function formatAtomicFusd(atomic?: string): string {
  if (!atomic || !/^[0-9]+$/u.test(atomic)) return "0.001 fUSD";
  const normalized = atomic.replace(/^0+/u, "") || "0";
  if (normalized === "0") return "0 fUSD";
  const padded = normalized.padStart(7, "0");
  const whole = padded.slice(0, -6);
  const frac = padded.slice(-6).replace(/0+$/u, "");
  return frac ? `${whole}.${frac} fUSD` : `${whole} fUSD`;
}

export function slugifyName(value: string): string {
  return suggestFacetName(value);
}

export function truncateMiddle(value: string, head = 8, tail = 6): string {
  if (value.length <= head + tail + 1) return value;
  return `${value.slice(0, head)}…${value.slice(-tail)}`;
}

export function snowtraceAddressUrl(address: string): string {
  return `https://testnet.snowtrace.io/address/${address}`;
}

export function snowtraceTxUrl(txHash: string): string {
  return `https://testnet.snowtrace.io/tx/${txHash}`;
}

export function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/u.test(value.trim());
}

export function isValidTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/u.test(value.trim());
}
