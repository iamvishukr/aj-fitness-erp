"use server";

import bcrypt from "bcryptjs";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { one, query } from "@/lib/db";
import {
  clearFailures,
  createSession,
  destroySession,
  isThrottled,
  recordFailure,
  requireAdmin,
} from "@/lib/auth";
import { planEndDate, todayISO } from "@/lib/dates";
import { normalizePhone } from "@/lib/contact";

export type FormState = { error?: string; ok?: string } | undefined;

const ISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
const optStr = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : null));
const optDate = z
  .string()
  .optional()
  .transform((v) => (v ? v : null))
  .pipe(ISO.nullable());
const money = z.coerce.number().int("Use whole rupees").min(0, "Can't be negative");
const optNum = (min: number, max: number, label: string) =>
  z
    .string()
    .optional()
    .transform((v) => (v && v.trim() ? Number(v) : null))
    .pipe(z.number().min(min, `${label} looks wrong`).max(max, `${label} looks wrong`).nullable());
const METHODS = ["cash", "upi", "card", "bank", "other"] as const;

function firstError(e: z.ZodError) {
  const i = e.issues[0];
  const field = i.path.join(".");
  return field ? `${field.replace(/_/g, " ")}: ${i.message}` : i.message;
}

function refreshAll() {
  revalidatePath("/", "layout");
}

/* ---------------- Auth ---------------- */

export async function login(_: FormState, fd: FormData): Promise<FormState> {
  const email = String(fd.get("email") || "").trim().toLowerCase();
  const password = String(fd.get("password") || "");
  const ip = (await headers()).get("x-forwarded-for")?.split(",")[0] ?? "local";
  const key = `${email}|${ip}`;
  if (isThrottled(key)) return { error: "Too many attempts. Try again in 15 minutes." };

  const admin = await one<{ id: number; password_hash: string; token_version: number }>(
    "SELECT id, password_hash, token_version FROM admins WHERE email=$1",
    [email],
  );
  const ok = admin ? await bcrypt.compare(password, admin.password_hash) : false;
  if (!admin || !ok) {
    recordFailure(key);
    return { error: "Wrong email or password." };
  }
  clearFailures(key);
  await createSession(admin.id, admin.token_version);
  redirect("/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function logoutEverywhere() {
  const admin = await requireAdmin();
  await query("UPDATE admins SET token_version = token_version + 1 WHERE id=$1", [admin.id]);
  await destroySession();
  redirect("/login");
}

export async function changePassword(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const current = String(fd.get("current") || "");
  const next = String(fd.get("next") || "");
  const confirm = String(fd.get("confirm") || "");
  if (next.length < 8) return { error: "New password must be at least 8 characters." };
  if (next !== confirm) return { error: "New passwords don't match." };
  const row = await one<{ password_hash: string; token_version: number }>(
    "SELECT password_hash, token_version FROM admins WHERE id=$1",
    [admin.id],
  );
  if (!row || !(await bcrypt.compare(current, row.password_hash))) return { error: "Current password is wrong." };
  const hash = await bcrypt.hash(next, 10);
  // Bump token version so other devices are signed out, then re-sign this device.
  await query("UPDATE admins SET password_hash=$1, token_version=token_version+1 WHERE id=$2", [hash, admin.id]);
  await query("DELETE FROM settings WHERE key='default_password'");
  await createSession(admin.id, row.token_version + 1);
  refreshAll();
  return { ok: "Password updated. Other devices were signed out." };
}

export async function updateProfile(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = z
    .object({
      gym_name: z.string().trim().min(1, "Required").max(80),
      gym_address: z.string().trim().max(200).default(""),
      gym_phone: z.string().trim().max(20).default(""),
      name: z.string().trim().min(1, "Required").max(80),
      email: z.string().trim().toLowerCase().pipe(z.email("Invalid email")),
    })
    .safeParse(Object.fromEntries(fd));
  if (!parsed.success) return { error: firstError(parsed.error) };
  const { gym_name, gym_address, gym_phone, name, email } = parsed.data;
  const clash = await one("SELECT id FROM admins WHERE email=$1 AND id<>$2", [email, admin.id]);
  if (clash) return { error: "That email is already used by another admin." };
  await query("UPDATE admins SET name=$1, email=$2 WHERE id=$3", [name, email, admin.id]);
  await query(
    `INSERT INTO settings (key,value) VALUES ('gym_name',$1), ('gym_address',$2), ('gym_phone',$3)
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value`,
    [gym_name, gym_address, gym_phone],
  );
  refreshAll();
  return { ok: "Saved." };
}

/* ---------------- Members ---------------- */

const memberSchema = z.object({
  name: z.string().trim().min(2, "Enter the full name").max(100),
  phone: z
    .string()
    .transform(normalizePhone)
    .pipe(z.string().min(10, "Enter a valid phone number").max(15, "Enter a valid phone number")),
  gender: optStr,
  dob: optDate,
  address: optStr,
  emergency_contact: optStr,
  email: z
    .string()
    .trim()
    .toLowerCase()
    .optional()
    .transform((v) => (v ? v : null))
    .pipe(z.email("Enter a valid email").nullable()),
  height_cm: optNum(50, 250, "Height").transform((v) => (v === null ? null : Math.round(v))),
  weight_kg: optNum(10, 300, "Weight").transform((v) => (v === null ? null : Math.round(v * 10) / 10)),
  health_notes: optStr,
  notes: optStr,
  joined_on: ISO,
  auto_wa: z
    .string()
    .optional()
    .transform((v) => v === "1"),
});

const subscriptionSchema = z.object({
  plan_id: z.coerce.number().int().positive("Choose a plan"),
  start_date: ISO,
  fee: money,
  discount: money.default(0),
  paid: money.default(0),
  method: z.enum(METHODS).default("cash"),
});

async function addSubscription(memberId: number, s: z.infer<typeof subscriptionSchema>) {
  const plan = await one<{ id: number; name: string; duration_days: number; duration_months: number | null }>(
    "SELECT id, name, duration_days, duration_months FROM plans WHERE id=$1",
    [s.plan_id],
  );
  if (!plan) throw new Error("Plan not found");
  if (s.discount > s.fee) throw new Error("Discount can't be more than the fee");
  const end = planEndDate(s.start_date, plan);
  const ms = await one<{ id: number }>(
    `INSERT INTO memberships (member_id, plan_id, plan_name, start_date, end_date, fee, discount)
     VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
    [memberId, plan.id, plan.name, s.start_date, end, s.fee, s.discount],
  );
  if (s.paid > 0) {
    await query(
      "INSERT INTO payments (member_id, membership_id, amount, method, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)",
      [memberId, ms!.id, s.paid, s.method, todayISO(), `${plan.name} plan`],
    );
  }
}

export async function createMember(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const raw = Object.fromEntries(fd) as Record<string, string>;
  const m = memberSchema.safeParse(raw);
  if (!m.success) return { error: firstError(m.error) };
  const s = subscriptionSchema.safeParse(raw);
  if (!s.success) return { error: firstError(s.error) };
  if (s.data.discount > s.data.fee) return { error: "Discount can't be more than the fee." };

  const dup = await one<{ id: number; name: string }>("SELECT id, name FROM members WHERE phone=$1", [m.data.phone]);
  if (dup && raw.allow_duplicate !== "1") {
    return { error: `${dup.name} already uses this phone number. Tick "same phone is OK" to add anyway.` };
  }
  const d = m.data;
  const row = await one<{ id: number }>(
    `INSERT INTO members (name, phone, gender, dob, address, emergency_contact, height_cm, weight_kg, health_notes, notes, joined_on, email, auto_wa)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING id`,
    [d.name, d.phone, d.gender, d.dob, d.address, d.emergency_contact, d.height_cm, d.weight_kg, d.health_notes, d.notes, d.joined_on, d.email, d.auto_wa],
  );
  try {
    await addSubscription(row!.id, s.data);
  } catch (e) {
    await query("DELETE FROM members WHERE id=$1", [row!.id]);
    return { error: (e as Error).message };
  }
  refreshAll();
  redirect(`/members/${row!.id}?new=1`);
}

export async function updateMember(id: number, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const m = memberSchema.safeParse(Object.fromEntries(fd));
  if (!m.success) return { error: firstError(m.error) };
  const d = m.data;
  await query(
    `UPDATE members SET name=$1, phone=$2, gender=$3, dob=$4, address=$5, emergency_contact=$6, height_cm=$7,
     weight_kg=$8, health_notes=$9, notes=$10, joined_on=$11, email=$12, auto_wa=$13 WHERE id=$14`,
    [d.name, d.phone, d.gender, d.dob, d.address, d.emergency_contact, d.height_cm, d.weight_kg, d.health_notes, d.notes, d.joined_on, d.email, d.auto_wa, id],
  );
  refreshAll();
  redirect(`/members/${id}`);
}

export async function deleteMember(id: number) {
  await requireAdmin();
  await query("DELETE FROM members WHERE id=$1", [id]);
  refreshAll();
  redirect("/members");
}

export async function renewMembership(memberId: number, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const s = subscriptionSchema.safeParse(Object.fromEntries(fd));
  if (!s.success) return { error: firstError(s.error) };
  try {
    await addSubscription(memberId, s.data);
  } catch (e) {
    return { error: (e as Error).message };
  }
  refreshAll();
  redirect(`/members/${memberId}?renewed=1`);
}

export async function extendMembership(memberId: number, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = z
    .object({ days: z.coerce.number().int("Whole days only").min(1, "At least 1 day").max(365, "Max 365 days"), reason: optStr })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstError(p.error) };
  const cur = await one<{ id: number }>(
    "SELECT id FROM memberships WHERE member_id=$1 ORDER BY end_date DESC, id DESC LIMIT 1",
    [memberId],
  );
  if (!cur) return { error: "No membership to extend." };
  await query(
    `UPDATE memberships SET end_date = end_date + $1::int, extra_days = extra_days + $1::int,
       extra_note = CASE WHEN $2::text IS NULL THEN extra_note ELSE concat_ws('; ', extra_note, $2::text) END
     WHERE id=$3`,
    [p.data.days, p.data.reason, cur.id],
  );
  refreshAll();
  return { ok: `Extended by ${p.data.days} days.` };
}

export async function deleteMembership(memberId: number, membershipId: number) {
  await requireAdmin();
  await query("DELETE FROM memberships WHERE id=$1 AND member_id=$2", [membershipId, memberId]);
  refreshAll();
}

/* ---------------- Payments ---------------- */

export async function recordPayment(memberId: number, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = z
    .object({
      amount: money.refine((n) => n > 0, "Enter an amount"),
      method: z.enum(METHODS),
      paid_on: ISO,
      note: optStr,
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstError(p.error) };
  const cur = await one<{ id: number }>(
    "SELECT id FROM memberships WHERE member_id=$1 ORDER BY end_date DESC, id DESC LIMIT 1",
    [memberId],
  );
  await query(
    "INSERT INTO payments (member_id, membership_id, amount, method, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)",
    [memberId, cur?.id ?? null, p.data.amount, p.data.method, p.data.paid_on, p.data.note],
  );
  refreshAll();
  redirect(`/members/${memberId}?paid=${p.data.amount}`);
}

export async function deletePayment(memberId: number, paymentId: number) {
  await requireAdmin();
  await query("DELETE FROM payments WHERE id=$1 AND member_id=$2", [paymentId, memberId]);
  refreshAll();
}

/* ---------------- Attendance ---------------- */

export async function checkIn(memberId: number) {
  await requireAdmin();
  await query("INSERT INTO attendance (member_id, day) VALUES ($1,$2) ON CONFLICT (member_id, day) DO NOTHING", [
    memberId,
    todayISO(),
  ]);
  refreshAll();
}

export async function undoCheckIn(memberId: number) {
  await requireAdmin();
  await query("DELETE FROM attendance WHERE member_id=$1 AND day=$2", [memberId, todayISO()]);
  refreshAll();
}

/* ---------------- Plans ---------------- */

const planSchema = z
  .object({
    name: z.string().trim().min(1, "Enter a name").max(60),
    length: z.coerce.number().int("Whole numbers only").min(1, "At least 1").max(3650),
    unit: z.enum(["months", "days"]).default("months"),
    price: money,
  })
  .refine((p) => p.unit === "days" || p.length <= 60, { message: "Max 60 months", path: ["length"] })
  .transform((p) => ({
    name: p.name,
    price: p.price,
    duration_months: p.unit === "months" ? p.length : null,
    duration_days: p.unit === "months" ? p.length * 30 : p.length,
  }));

export async function createPlan(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = planSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstError(p.error) };
  await query("INSERT INTO plans (name, duration_days, duration_months, price) VALUES ($1,$2,$3,$4)", [
    p.data.name,
    p.data.duration_days,
    p.data.duration_months,
    p.data.price,
  ]);
  refreshAll();
  return { ok: `${p.data.name} added.` };
}

export async function updatePlan(id: number, _: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const p = planSchema.safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstError(p.error) };
  await query("UPDATE plans SET name=$1, duration_days=$2, duration_months=$3, price=$4 WHERE id=$5", [
    p.data.name,
    p.data.duration_days,
    p.data.duration_months,
    p.data.price,
    id,
  ]);
  refreshAll();
  return { ok: "Saved." };
}

export async function togglePlan(id: number) {
  await requireAdmin();
  await query("UPDATE plans SET active = NOT active WHERE id=$1", [id]);
  refreshAll();
}

/* ---------------- Demo data ---------------- */

export async function loadDemoData() {
  await requireAdmin();
  const { seedDemo } = await import("@/lib/seed");
  const n = await one<{ n: number }>("SELECT count(*)::int AS n FROM members");
  if (n && n.n === 0) await seedDemo();
  refreshAll();
}

export async function removeDemoData() {
  await requireAdmin();
  const { removeDemo } = await import("@/lib/seed");
  await removeDemo();
  refreshAll();
}

/* ---------------- Automatic WhatsApp reminders ---------------- */

export async function saveReminderSettingsAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const { saveReminderSettings } = await import("@/lib/reminders");
  const p = z
    .object({
      enabled: z.string().optional().transform((v) => v === "1"),
      expiring: z.string().optional().transform((v) => v === "1"),
      expired: z.string().optional().transform((v) => v === "1"),
      due: z.string().optional().transform((v) => v === "1"),
      daysBefore: z.coerce.number().int().min(0).max(30),
      daysAfter: z.coerce.number().int().min(1).max(60),
      dueEvery: z.coerce.number().int().min(1).max(60),
    })
    .safeParse(Object.fromEntries(fd));
  if (!p.success) return { error: firstError(p.error) };
  await saveReminderSettings(p.data);
  revalidatePath("/reminders");
  return { ok: p.data.enabled ? "Saved. Reminders will go out every morning (10–11 am)." : "Saved. Automatic reminders are off." };
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function runRemindersNow(_: FormState, _fd: FormData): Promise<FormState> {
  await requireAdmin();
  const { runReminders } = await import("@/lib/reminders");
  const r = await runReminders({ force: true });
  revalidatePath("/reminders");
  if (!r.connected) return { ok: `${r.planned} reminder(s) due today. Not sent — WhatsApp isn't connected yet.` };
  return { ok: `Done: ${r.sent} sent, ${r.failed} failed (of ${r.planned} due today).` };
}

export async function sendTestReminder(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const { TEMPLATES } = await import("@/lib/reminders");
  const { sendTemplate, whatsappConfigured } = await import("@/lib/whatsapp");
  const { getGymInfo } = await import("@/lib/data");
  if (!whatsappConfigured()) return { error: "WhatsApp isn't connected yet (see setup steps below)." };
  const phone = normalizePhone(String(fd.get("phone") || ""));
  if (phone.length < 10) return { error: "Enter a valid phone number." };
  const g = await getGymInfo();
  const t = TEMPLATES.expiring;
  const r = await sendTemplate(phone, t.name, ["Test", g.name, "One Month", "31 Dec 2026", g.phone || "-"]);
  return r.ok ? { ok: `Test message sent to ${phone}.` } : { error: `WhatsApp error — ${r.error}` };
}
