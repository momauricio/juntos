/** Brazilian date helpers (display DD/MM/YYYY, store YYYY-MM-DD). */

export function isoToBr(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "";
  const [year, month, day] = iso.split("-");
  return `${day}/${month}/${year}`;
}

export function brToIso(br: string): string | null {
  const match = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Progressive mask while typing digits: 20 → 20, 2008 → 20/08, … */
export function maskBrDateInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function formatIsoRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  if (start && end) return `${isoToBr(start)} → ${isoToBr(end)}`;
  return isoToBr(start || end || "");
}

export function destinationDateError(
  destinations: Array<{
    name: string;
    startDate: string;
    endDate: string;
  }>,
  index: number,
): string | null {
  const destination = destinations[index];
  if (!destination.startDate || !destination.endDate) {
    return "Defina início e fim (DD/MM/AAAA).";
  }
  if (destination.endDate < destination.startDate) {
    return "Fim precisa ser no mesmo dia ou depois do início.";
  }
  if (index > 0) {
    const previous = destinations[index - 1];
    if (
      previous.endDate &&
      destination.startDate &&
      destination.startDate < previous.endDate
    ) {
      const prevLabel = previous.name.trim() || `destino ${index}`;
      return `Começa no meio de ${prevLabel}. Use a partir de ${isoToBr(previous.endDate)}.`;
    }
  }
  return null;
}

function parseIsoUtc(iso: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null;
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function addDaysIso(iso: string, days: number): string | null {
  const date = parseIsoUtc(iso);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** Day 1 = trip start date. */
export function tripDateFromDayNumber(
  tripStartIso: string,
  day: number,
): string | null {
  if (!Number.isInteger(day) || day < 1) return null;
  return addDaysIso(tripStartIso, day - 1);
}

/** Convert calendar date to trip day number (1-based). */
export function dayNumberFromTripDate(
  tripStartIso: string,
  dateIso: string,
): number | null {
  const start = parseIsoUtc(tripStartIso);
  const date = parseIsoUtc(dateIso);
  if (!start || !date) return null;
  const diff = Math.round((date.getTime() - start.getTime()) / 86_400_000) + 1;
  if (diff < 1) return null;
  return diff;
}
