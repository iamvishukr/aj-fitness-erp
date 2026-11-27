import "server-only";
import { one, query } from "./db";
import { addDays, diffDays, todayISO } from "./dates";

export type Status = "active" | "expiring" | "expired" | "none";

export type MemberRow = {
  id: number;
  name: string;
  phone: string;
  gender: string | null;
  dob: string | null;
  joined_on: string;
  plan_name: string | null;
  start_date: string | null;
  end_date: string | null;
  due: number;
  last_visit: string | null;
};

export type MemberSummary = MemberRow & { status: Status; daysLeft: number | null };

export const EXPIRING_WINDOW = Number(process.env.EXPIRING_WINDOW_DAYS || 7);

export function statusOf(endDate: string | null, today = todayISO()): { status: Status; daysLeft: number | null } {
  if (!endDate) return { status: "none", daysLeft: null };
  const daysLeft = diffDays(today, endDate);
  if (daysLeft < 0) return { status: "expired", daysLeft };
  if (daysLeft <= EXPIRING_WINDOW) return { status: "expiring", daysLeft };
  return { status: "active", daysLeft };
}

const MEMBER_SUMMARY_SQL = `
WITH cur AS (
  SELECT DISTINCT ON (member_id) member_id, plan_name, start_date, end_date
  FROM memberships ORDER BY member_id, end_date DESC, id DESC
), billed AS (
  SELECT member_id, SUM(fee - discount)::int AS billed FROM memberships GROUP BY member_id
), paid AS (
  SELECT member_id, SUM(amount)::int AS paid FROM payments GROUP BY member_id
), visits AS (
  SELECT member_id, MAX(day) AS last_visit FROM attendance GROUP BY member_id
)
SELECT m.id, m.name, m.phone, m.gender, m.dob, m.joined_on,
       cur.plan_name, cur.start_date, cur.end_date,
       (COALESCE(b.billed,0) - COALESCE(p.paid,0))::int AS due,
       v.last_visit
FROM members m
LEFT JOIN cur ON cur.member_id = m.id
LEFT JOIN billed b ON b.member_id = m.id
LEFT JOIN paid p ON p.member_id = m.id
LEFT JOIN visits v ON v.member_id = m.id
`;

export async function getMemberSummaries(): Promise<MemberSummary[]> {
  const today = todayISO();
  const rows = await query<MemberRow>(MEMBER_SUMMARY_SQL + " ORDER BY m.name ASC");
  return rows.map((r) => ({ ...r, ...statusOf(r.end_date, today) }));
}

export async function getMemberSummary(id: number): Promise<MemberSummary | null> {
  const r = await one<MemberRow>(MEMBER_SUMMARY_SQL + " WHERE m.id = $1", [id]);
  return r ? { ...r, ...statusOf(r.end_date) } : null;
}

export type MemberFull = {
  id: number;
  name: string;
  phone: string;
  gender: string | null;
  dob: string | null;
  address: string | null;
  emergency_contact: string | null;
  height_cm: number | null;
  weight_kg: string | null;
  health_notes: string | null;
  notes: string | null;
  joined_on: string;
};

export function getMember(id: number) {
  return one<MemberFull>("SELECT * FROM members WHERE id=$1", [id]);
}

export type Membership = {
  id: number;
  plan_name: string;
  start_date: string;
  end_date: string;
  fee: number;
  discount: number;
  extra_days: number;
  extra_note: string | null;
};
export function getMemberships(memberId: number) {
  return query<Membership>(
    "SELECT id, plan_name, start_date, end_date, fee, discount, extra_days, extra_note FROM memberships WHERE member_id=$1 ORDER BY end_date DESC, id DESC",
    [memberId],
  );
}

export type Payment = {
  id: number;
  member_id: number;
  member_name?: string;
  amount: number;
  method: string;
  paid_on: string;
  note: string | null;
};
export function getPaymentsForMember(memberId: number) {
  return query<Payment>(
    "SELECT id, member_id, amount, method, paid_on, note FROM payments WHERE member_id=$1 ORDER BY paid_on DESC, id DESC",
    [memberId],
  );
}

export function getPaymentsBetween(from: string, to: string) {
  return query<Payment>(
    `SELECT p.id, p.member_id, m.name AS member_name, p.amount, p.method, p.paid_on, p.note
     FROM payments p JOIN members m ON m.id = p.member_id
     WHERE p.paid_on >= $1 AND p.paid_on <= $2 ORDER BY p.paid_on DESC, p.id DESC`,
    [from, to],
  );
}

export async function getAttendanceStats(memberId: number) {
  const today = todayISO();
  const r = await one<{ month: number; total: number; today: number }>(
    `SELECT
       COUNT(*) FILTER (WHERE day >= $2)::int AS month,
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE day = $3)::int AS today
     FROM attendance WHERE member_id=$1`,
    [memberId, today.slice(0, 8) + "01", today],
  );
  return r ?? { month: 0, total: 0, today: 0 };
}

export function getRecentVisits(memberId: number, limit = 14) {
  return query<{ day: string }>("SELECT day FROM attendance WHERE member_id=$1 ORDER BY day DESC LIMIT $2", [
    memberId,
    limit,
  ]);
}

export type Plan = { id: number; name: string; duration_days: number; price: number; active: boolean };
export function getPlans(activeOnly = false) {
  return query<Plan>(
    `SELECT id, name, duration_days, price, active FROM plans ${activeOnly ? "WHERE active" : ""} ORDER BY duration_days, price`,
  );
}

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const r = await one<{ value: string }>("SELECT value FROM settings WHERE key=$1", [key]);
  return r?.value ?? fallback;
}

export function getGymName() {
  return getSetting("gym_name", "AJ Fitness");
}

export async function getRevenue(from: string, to: string) {
  const r = await one<{ total: number; count: number }>(
    "SELECT COALESCE(SUM(amount),0)::int AS total, COUNT(*)::int AS count FROM payments WHERE paid_on >= $1 AND paid_on <= $2",
    [from, to],
  );
  return r ?? { total: 0, count: 0 };
}

export async function getMonthlyRevenue(months = 6) {
  const today = todayISO();
  const start = new Date(today.slice(0, 7) + "-01T00:00:00Z");
  start.setUTCMonth(start.getUTCMonth() - (months - 1));
  const from = start.toISOString().slice(0, 10);
  const rows = await query<{ ym: string; total: number }>(
    `SELECT to_char(paid_on, 'YYYY-MM') AS ym, SUM(amount)::int AS total FROM payments
     WHERE paid_on >= $1 GROUP BY ym ORDER BY ym`,
    [from],
  );
  const map = new Map(rows.map((r) => [r.ym, r.total]));
  const out: { ym: string; label: string; total: number }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(start);
    d.setUTCMonth(start.getUTCMonth() + i);
    const ym = d.toISOString().slice(0, 7);
    out.push({ ym, label: d.toLocaleDateString("en-IN", { month: "short", timeZone: "UTC" }), total: map.get(ym) ?? 0 });
  }
  return out;
}

export function getTodayCheckins() {
  return query<{ id: number; member_id: number; name: string; phone: string; checked_in_ms: number }>(
    `SELECT a.id, a.member_id, m.name, m.phone, (extract(epoch from a.checked_in_at)*1000)::bigint AS checked_in_ms
     FROM attendance a JOIN members m ON m.id = a.member_id
     WHERE a.day = $1 ORDER BY a.checked_in_at DESC`,
    [todayISO()],
  );
}

/** Next start date when renewing: day after current end (if still running), else today. */
export function suggestedRenewalStart(endDate: string | null): string {
  const today = todayISO();
  if (endDate && endDate >= today) return addDays(endDate, 1);
  return today;
}
