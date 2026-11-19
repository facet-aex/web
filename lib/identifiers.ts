export const USERNAME_PATTERN = "^[a-z0-9](?:[a-z0-9-]{6,14}[a-z0-9])$";
export const USERNAME_REGEX = new RegExp(USERNAME_PATTERN, "u");

export const FACET_NAME_PATTERN = "^[a-z0-9](?:[a-z0-9-]{2,30}[a-z0-9])$";
export const FACET_NAME_REGEX = new RegExp(FACET_NAME_PATTERN, "u");

export const SEMVER_PATTERN =
  "^(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)\\.(?:0|[1-9][0-9]*)$";
export const SEMVER_REGEX = new RegExp(SEMVER_PATTERN, "u");

export const FACET_TYPES = ["API", "ACTOR", "AGENT"] as const;
export type FacetType = (typeof FACET_TYPES)[number];

export const PRICING_MODELS = ["PAY_PER_RUN", "PAY_PER_RESULT"] as const;
export type PricingModel = (typeof PRICING_MODELS)[number];

export function isValidUsername(value: string): boolean {
  return USERNAME_REGEX.test(value);
}

export function isValidFacetName(value: string): boolean {
  return FACET_NAME_REGEX.test(value);
}

export function isValidSemver(value: string): boolean {
  return SEMVER_REGEX.test(value);
}

export function suggestFacetName(
  title: string,
  fallback = "custom-facet",
): string {
  let cleaned = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .replace(/đ/gu, "d")
    .replace(/Đ/gu, "d")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 32)
    .replace(/-+$/gu, "");

  if (!cleaned) cleaned = fallback;
  while (cleaned.length < 4) {
    cleaned = `${cleaned}-fct`.slice(0, 32);
  }
  cleaned = cleaned.replace(/-+$/gu, "");
  return isValidFacetName(cleaned) ? cleaned : fallback;
}

export function bumpSemver(
  current: string,
  kind: "patch" | "minor" | "major",
): string {
  const match = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u.exec(
    current.trim(),
  );
  if (!match) return "1.0.0";
  const major = Number(match[1]);
  const minor = Number(match[2]);
  const patch = Number(match[3]);
  if (kind === "major") return `${major + 1}.0.0`;
  if (kind === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}
