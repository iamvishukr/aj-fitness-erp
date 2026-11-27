import "server-only";
import { one, query } from "./db";
import { getGymInfo, getMemberSummaries, type GymInfo, type MemberSummary } from "./data";
import { addDays, fmtDate, todayISO } from "./dates";
import { sendTemplate, whatsappConfigured } from "./whatsapp";

/**
 * Message templates. Each must be created (category: UTILITY, language: English) and approved
 * in WhatsApp Manager with exactly this name and body — the {{n}} placeholders are filled in order.
 */
export const TEMPLATES = {
  expiring: {
    name: "membership_expiring",
    label: "Membership expiring",
    body:
      "Hi {{1}}, your {{2}} membership ({{3}}) is valid till {{4}}. Please renew on time to continue your workouts without a break. For any help, call us on {{5}}. Thank you!",
    params: (m: MemberSummary, g: GymInfo) => [first(m.name), g.name, m.plan_name ?? "membership", fmtDate(m.end_date), g.phone || "-"],
  },
  expired: {
    name: "membership_expired",
    label: "Membership expired",
    body:
      "Hi {{1}}, your {{2}} membership expired on {{3}}. Renew today to get back on track with your fitness. Visit us at {{4}} or call {{5}}. Thank you!",
    params: (m: MemberSummary, g: GymInfo) => [first(m.name), g.name, fmtDate(m.end_date), g.address || g.name, g.phone || "-"],
  },
  due: {
    name: "payment_due",
    label: "Payment due",
    body:
      "Hi {{1}}, this is a reminder from {{2}} that Rs. {{3}} is pending on your membership. Please clear it at the front desk or via UPI. For any help, call us on {{4}}. Thank you!",
    params: (m: MemberSummary, g: GymInfo) => [first(m.name), g.name, m.due.toLocaleString("en-IN"), g.phone || "-"],
  },
} as const;
export type ReminderKind = keyof typeof TEMPLATES;

function first(name: string) {
  return name.trim().split(/\s+/)[0] || name;
}

export type ReminderSettings = {
  enabled: boolean;
  expiring: boolean;
  expired: boolean;
  due: boolean;
  daysBefore: number; // send "expiring" when this many days (or fewer) are left
  daysAfter: number; // send "expired" up to this many days after expiry
  dueEvery: number; // repeat dues reminder every N days while money is pending
};

export const DEFAULT_SETTINGS: ReminderSettings = {
  enabled: false,
  expiring: true,
  expired: true,
  due: true,
  daysBefore: 3,
  daysAfter: 3,
  dueEvery: 7,
};

export async function getReminderSettings(): Promise<ReminderSettings> {
  const row = await one<{ value: string }>("SELECT value FROM settings WHERE key='reminder_settings'");
  if (!row) return DEFAULT_SETTINGS;
  try {
    return { ...DEFAULT_SETTINGS, ...JSON.parse(row.value) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveReminderSettings(s: ReminderSettings) {
  await query(
    "INSERT INTO settings (key, value) VALUES ('reminder_settings',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
    [JSON.stringify(s)],
  );
}

type Planned = { member: MemberSummary; kind: ReminderKind; ref: string };

/** Works out who should get which reminder today. One message per member per run (most important first). */
export async function planReminders(settings: ReminderSettings, today = todayISO()): Promise<Planned[]> {
  const members = (await getMemberSummaries()).filter((m) => m.end_date);
  const optedIn = new Set(
    (await query<{ id: number }>("SELECT id FROM members WHERE auto_wa AND NOT is_demo")).map((r) => r.id),
  );
  // Already sent (refs are per membership period, so a renewal starts a fresh cycle)
  const sent = await query<{ member_id: number; kind: string; ref: string; day: string }>(
    "SELECT member_id, kind, ref, (created_at AT TIME ZONE $1)::date::text AS day FROM reminder_log WHERE status='sent' AND member_id IS NOT NULL",
    [process.env.GYM_TIMEZONE || "Asia/Kolkata"],
  );
  const sentRefs = new Set(sent.map((s) => `${s.member_id}|${s.kind}|${s.ref}`));
  // At most one message attempt per member per day (sent or failed), and give up after 3 failures
  const tz = process.env.GYM_TIMEZONE || "Asia/Kolkata";
  const touchedToday = new Set(
    (
      await query<{ member_id: number }>(
        `SELECT DISTINCT member_id FROM reminder_log
         WHERE status IN ('sent','failed') AND (created_at AT TIME ZONE $1)::date = $2::date`,
        [tz, today],
      )
    ).map((r) => r.member_id),
  );
  const failCount = new Map<string, number>();
  for (const f of await query<{ k: string; n: number }>(
    "SELECT member_id || '|' || kind || '|' || ref AS k, count(*)::int AS n FROM reminder_log WHERE status='failed' GROUP BY 1",
  ))
    failCount.set(f.k, f.n);
  const gaveUp = (memberId: number, kind: string, ref: string) => (failCount.get(`${memberId}|${kind}|${ref}`) ?? 0) >= 3;
  const lastDue = new Map<number, string>();
  for (const s of sent) if (s.kind === "due" && (lastDue.get(s.member_id) ?? "") < s.day) lastDue.set(s.member_id, s.day);

  const out: Planned[] = [];
  for (const m of members) {
    if (!optedIn.has(m.id) || m.daysLeft === null || touchedToday.has(m.id)) continue;
    const d = m.daysLeft;
    if (settings.expiring && d >= 0 && d <= settings.daysBefore) {
      const ref = `${m.end_date}`;
      if (!sentRefs.has(`${m.id}|expiring|${ref}`) && !gaveUp(m.id, "expiring", ref)) {
        out.push({ member: m, kind: "expiring", ref });
        continue;
      }
    }
    if (settings.expired && d < 0 && -d <= settings.daysAfter) {
      const ref = `${m.end_date}`;
      if (!sentRefs.has(`${m.id}|expired|${ref}`) && !gaveUp(m.id, "expired", ref)) {
        out.push({ member: m, kind: "expired", ref });
        continue;
      }
    }
    // Dues: only for current members or those who lapsed within 30 days
    if (settings.due && m.due > 0 && d >= -30) {
      const last = lastDue.get(m.id);
      if ((!last || last <= addDays(today, -settings.dueEvery)) && !gaveUp(m.id, "due", today)) {
        out.push({ member: m, kind: "due", ref: today });
      }
    }
  }
  return out;
}

export type RunSummary = { planned: number; sent: number; failed: number; skipped: number; connected: boolean; enabled: boolean };

/** The daily job. When WhatsApp isn't connected (or reminders are off) nothing is sent; the plan is logged as "skipped". */
export async function runReminders(opts: { force?: boolean } = {}): Promise<RunSummary> {
  const settings = await getReminderSettings();
  const connected = whatsappConfigured();
  const gym = await getGymInfo();
  const plan = await planReminders(settings);
  const live = connected && (settings.enabled || opts.force === true);
  const summary: RunSummary = { planned: plan.length, sent: 0, failed: 0, skipped: 0, connected, enabled: settings.enabled };

  for (const p of plan) {
    const t = TEMPLATES[p.kind];
    if (!live) {
      summary.skipped++;
      const why = !connected ? "WhatsApp not connected" : "Automatic reminders are off";
      // Log a skipped entry at most once per member/kind/ref per day to keep the log readable
      await query(
        `INSERT INTO reminder_log (member_id, kind, ref, status, detail)
         SELECT $1,$2,$3,'skipped',$4
         WHERE NOT EXISTS (SELECT 1 FROM reminder_log WHERE member_id=$1 AND kind=$2 AND ref=$3 AND status='skipped'
                           AND created_at > now() - interval '20 hours')`,
        [p.member.id, p.kind, p.ref, why],
      );
      continue;
    }
    const r = await sendTemplate(p.member.phone, t.name, [...t.params(p.member, gym)]);
    await query("INSERT INTO reminder_log (member_id, kind, ref, status, detail) VALUES ($1,$2,$3,$4,$5)", [
      p.member.id,
      p.kind,
      p.ref,
      r.ok ? "sent" : "failed",
      r.ok ? r.id : r.error.slice(0, 300),
    ]);
    if (r.ok) summary.sent++;
    else summary.failed++;
  }
  await query(
    "INSERT INTO settings (key, value) VALUES ('reminder_last_run',$1) ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value",
    [JSON.stringify({ at: new Date().toISOString(), ...summary })],
  );
  // Keep the log small
  await query("DELETE FROM reminder_log WHERE created_at < now() - interval '180 days'");
  return summary;
}

/** Fill a template body with the real values, for previews in the app. */
export function renderTemplate(kind: ReminderKind, m: MemberSummary, g: GymInfo): string {
  const t = TEMPLATES[kind];
  const params = t.params(m, g);
  return t.body.replace(/\{\{(\d+)\}\}/g, (_, i) => params[Number(i) - 1] ?? "");
}
