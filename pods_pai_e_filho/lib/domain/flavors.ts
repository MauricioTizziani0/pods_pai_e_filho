export type IceFilter = "all" | "ice" | "nao_ice";

export type FlavorNameSource = {
  name: string;
  is_ice?: boolean | null;
};

const TRAILING_ICE = /\s+ice$/i;
const ICE_TOKEN = /(?:^|\s)ice$/i;

export function nameEndsWithIce(name: string) {
  return ICE_TOKEN.test(name.trim());
}

export function normalizeFlavorName(name: string, isIce: boolean) {
  let trimmed = name.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (!isIce) return trimmed;
  while (TRAILING_ICE.test(trimmed)) {
    const next = trimmed.replace(TRAILING_ICE, "").trim();
    if (!next) break;
    trimmed = next;
  }
  return trimmed;
}

export function getFlavorDisplayName(flavor: FlavorNameSource) {
  const name = flavor.name.trim();
  if (!flavor.is_ice) return name;
  if (nameEndsWithIce(name)) return name;
  return `${name} Ice`;
}

export function parseIceParam(value?: string | null): IceFilter {
  if (value === "sim" || value === "ice") return "ice";
  if (value === "nao" || value === "nao_ice") return "nao_ice";
  return "all";
}

export function iceFilterToBool(filter: IceFilter): boolean | null {
  if (filter === "ice") return true;
  if (filter === "nao_ice") return false;
  return null;
}

export function matchesIceFilter(isIce: boolean | null | undefined, filter: IceFilter) {
  if (filter === "all") return true;
  return Boolean(isIce) === (filter === "ice");
}

export function matchesFlavorSearch(flavor: FlavorNameSource, query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const name = flavor.name.toLowerCase();
  const display = getFlavorDisplayName(flavor).toLowerCase();
  if (name.includes(q) || display.includes(q)) return true;
  if (flavor.is_ice && q === "ice") return true;
  if (flavor.is_ice && q.endsWith(" ice")) {
    const base = q.replace(TRAILING_ICE, "").trim();
    return Boolean(base) && name.includes(base);
  }
  return false;
}

function sanitizeIlike(value: string) {
  return value.replace(/[%_,()]/g, " ").replace(/\s+/g, " ").trim();
}

/** Filtro PostgREST para localizar "Grape Ice" mesmo com name=Grape e is_ice=true. */
export function flavorSearchOrFilter(query: string) {
  const q = sanitizeIlike(query);
  if (!q) return null;
  const parts = [`variant_name.ilike.%${q}%`];
  const lower = q.toLowerCase();
  if (lower === "ice") {
    parts.push("variant_is_ice.eq.true");
  } else if (lower.endsWith(" ice")) {
    const base = sanitizeIlike(q.replace(TRAILING_ICE, ""));
    if (base) {
      parts.push(`and(variant_is_ice.eq.true,variant_name.ilike.%${base}%)`);
    }
  }
  return parts.join(",");
}
