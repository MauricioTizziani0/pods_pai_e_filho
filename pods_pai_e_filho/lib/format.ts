export function formatBRL(value: number | string | null | undefined) {
  const amount = typeof value === "number" ? value : Number(value ?? 0);
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(safe);
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function todayInBrazil() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function monthStartBrazil() {
  return `${todayInBrazil().slice(0, 8)}01`;
}

export function parseMoney(value: string) {
  const cleaned = value.trim().replace(/\s/g, "").replace(/^R\$/, "");
  if (!cleaned) return null;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const amount = Number(normalized);
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount * 100) / 100;
}

export function moneyToInput(value: string | number) {
  const amount = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(amount)) return "";
  return amount.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function resolvePeriod(params: {
  periodo?: string;
  de?: string;
  ate?: string;
}) {
  if (params.periodo === "mes") {
    return {
      from: monthStartBrazil(),
      to: todayInBrazil(),
      label: "Este mês",
    };
  }
  if (params.periodo === "personalizado" && params.de && params.ate) {
    return {
      from: params.de,
      to: params.ate,
      label: `${formatDate(params.de)} – ${formatDate(params.ate)}`,
    };
  }
  return { from: null, to: null, label: "Todo o período" };
}

export function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

export function slugCode(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
}
