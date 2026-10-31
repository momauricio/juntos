import type { Item } from "@/lib/types";

export const UNKNOWN_AUTHOR_NAME = "Pessoa do espaço";

const TIME_ZONE = "America/Sao_Paulo";
const MINUTE_MS = 60 * 1000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

const relativeFormatter = new Intl.RelativeTimeFormat("pt-BR", {
  numeric: "auto",
  style: "short",
});
const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});
const yearFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  timeZone: TIME_ZONE,
});
const shortDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  timeZone: TIME_ZONE,
});
const fullDateFormatter = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  timeZone: TIME_ZONE,
});

function formatRelative(value: number, unit: Intl.RelativeTimeFormatUnit) {
  return relativeFormatter.format(value, unit).replace(/\.$/, "");
}

// YYYY-MM-DD of the calendar day in São Paulo
function dayKey(date: Date) {
  return dayKeyFormatter.format(date);
}

function previousDayKey(date: Date) {
  const previous = new Date(`${dayKey(date)}T00:00:00Z`);
  previous.setUTCDate(previous.getUTCDate() - 1);
  return previous.toISOString().slice(0, 10);
}

export function formatRelativeTime(
  date: string | Date,
  now: Date = new Date(),
): string {
  const value = typeof date === "string" ? new Date(date) : date;
  const diff = now.getTime() - value.getTime();

  if (diff < MINUTE_MS) {
    return "agora";
  }

  if (diff < HOUR_MS) {
    return formatRelative(-Math.floor(diff / MINUTE_MS), "minute");
  }

  const valueDay = dayKey(value);

  if (diff < DAY_MS && valueDay === dayKey(now)) {
    return formatRelative(-Math.floor(diff / HOUR_MS), "hour");
  }

  if (valueDay === previousDayKey(now)) {
    return formatRelative(-1, "day");
  }

  return yearFormatter.format(value) === yearFormatter.format(now)
    ? shortDateFormatter.format(value)
    : fullDateFormatter.format(value);
}

export function addedByLabel(name: string, createdAt: string, now?: Date) {
  return `${name} adicionou · ${formatRelativeTime(createdAt, now)}`;
}

export function editedByLabel(
  item: Pick<Item, "created_by" | "updated_by" | "created_at" | "updated_at">,
  names: Map<string, string> | Record<string, string>,
  now?: Date,
): string | null {
  if (!item.updated_by) {
    return null;
  }

  const editedLater =
    new Date(item.updated_at).getTime() >
    new Date(item.created_at).getTime() + MINUTE_MS;

  if (item.updated_by === item.created_by && !editedLater) {
    return null;
  }

  const name =
    (names instanceof Map
      ? names.get(item.updated_by)
      : Object.hasOwn(names, item.updated_by)
        ? names[item.updated_by]
        : undefined) ?? UNKNOWN_AUTHOR_NAME;

  return `Editado por ${name} · ${formatRelativeTime(item.updated_at, now)}`;
}
