// Date helpers. Dates are stored as 'YYYY-MM-DD' strings and "today" is computed in the gym's timezone.
export const TZ = process.env.GYM_TIMEZONE || "Asia/Kolkata";

export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(
    new Date(),
  );
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function diffDays(fromIso: string, toIso: string): number {
  return Math.round((Date.parse(toIso + "T00:00:00Z") - Date.parse(fromIso + "T00:00:00Z")) / 86400000);
}

export function monthStart(iso: string): string {
  return iso.slice(0, 8) + "01";
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}

export function fmtShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00Z");
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function rupees(n: number | null | undefined): string {
  return "₹" + Math.round(Number(n || 0)).toLocaleString("en-IN");
}

export function relativeDays(days: number): string {
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days === -1) return "yesterday";
  return days > 0 ? `in ${days} days` : `${-days} days ago`;
}

/** Adds calendar months, clamping to the month's last day (31 Jan + 1 month → 28/29 Feb). */
export function addMonths(iso: string, months: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1 + months, 1));
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d, lastDay));
  return target.toISOString().slice(0, 10);
}

export type PlanLength = { duration_days: number; duration_months: number | null };

/** Last valid day of a plan starting on `start` (inclusive). 1 month from 27 Nov → 26 Dec. */
export function planEndDate(start: string, plan: PlanLength): string {
  if (plan.duration_months) return addDays(addMonths(start, plan.duration_months), -1);
  return addDays(start, plan.duration_days - 1);
}

export function durationLabel(plan: PlanLength): string {
  const m = plan.duration_months;
  if (m) return m === 12 ? "1 year" : m % 12 === 0 ? `${m / 12} years` : `${m} month${m === 1 ? "" : "s"}`;
  return `${plan.duration_days} day${plan.duration_days === 1 ? "" : "s"}`;
}
