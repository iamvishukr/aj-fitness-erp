import { fmtDate, rupees } from "./dates";

const CC = process.env.NEXT_PUBLIC_COUNTRY_CODE || "91";

/** Stores local numbers as plain 10 digits: "+91 98111-22233", "098111 22233" and "9811122233" are all the same member. */
export function normalizePhone(raw: string): string {
  let d = raw.replace(/\D/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10 + CC.length && d.startsWith(CC)) d = d.slice(CC.length);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/** Digits for wa.me (country code + number). */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, "");
  if (d.length === 10) return CC + d;
  if (d.length === 11 && d.startsWith("0")) return CC + d.slice(1);
  return d;
}

/**
 * Opens WhatsApp with the message ready to send.
 * Uses api.whatsapp.com/send rather than the wa.me short link: wa.me's redirect corrupts
 * multi-byte characters on some phones/desktop apps (they arrive as "�").
 */
export function waLink(phone: string, text: string): string {
  return `https://api.whatsapp.com/send?phone=${waNumber(phone)}&text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export type Gym = { name: string; address?: string; phone?: string };

// Messages use WhatsApp formatting (*bold*) and plain characters only — no emoji — so they
// look the same on every phone and WhatsApp version.
const first = (name: string) => name.trim().split(/\s+/)[0] || name;
const sig = (g: Gym) =>
  ["", "", `*${g.name}*`, g.address || "", g.phone ? `Call: ${g.phone}` : ""].filter((l, i) => i < 3 || l).join("\n");
const lines = (...l: (string | false | null | undefined)[]) => l.filter((x) => x !== false && x != null).join("\n");

type Ctx = { gym: Gym; name: string; endDate: string | null; daysLeft: number | null; due: number; plan?: string | null };

export function reminderMessage(c: Ctx): string {
  const plan = c.plan ? `*${c.plan}* ` : "";
  const due = c.due > 0 ? `\nPending balance: *${rupees(c.due)}*` : "";
  if (c.daysLeft === null || !c.endDate) {
    return lines(
      `Hi ${first(c.name)},`,
      "",
      `We miss you at *${c.gym.name}*! Come back and restart your fitness journey with us.`,
      "",
      "Reply to this message or visit the front desk to know our membership plans.",
    ) + sig(c.gym);
  }
  if (c.daysLeft < 0) {
    return lines(
      `Hi ${first(c.name)},`,
      "",
      `Your ${plan}membership at *${c.gym.name}* expired on *${fmtDate(c.endDate)}*.${due}`,
      "",
      "Renew today to get back on track. You can renew at the front desk or pay via UPI.",
      "",
      "Thank you!",
    ) + sig(c.gym);
  }
  const when =
    c.daysLeft === 0
      ? `expires *today* (${fmtDate(c.endDate)})`
      : `expires on *${fmtDate(c.endDate)}* (${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left)`;
  return lines(
    `Hi ${first(c.name)},`,
    "",
    `This is a friendly reminder from *${c.gym.name}*.`,
    "",
    `Your ${plan}membership ${when}.${due}`,
    "",
    "Please renew on time to keep your training going without a break. You can renew at the front desk or pay via UPI.",
    "",
    "Thank you!",
  ) + sig(c.gym);
}

export function dueMessage(gym: Gym, name: string, due: number): string {
  return lines(
    `Hi ${first(name)},`,
    "",
    `This is a gentle reminder from *${gym.name}* that *${rupees(due)}* is pending on your membership.`,
    "",
    "Please clear it at the front desk or via UPI at your earliest convenience.",
    "",
    "Thank you!",
  ) + sig(gym);
}

const METHOD: Record<string, string> = { cash: "Cash", upi: "UPI", card: "Card", bank: "Bank transfer", other: "Other" };

export function receiptMessage(
  gym: Gym,
  name: string,
  amount: number,
  date: string,
  endDate: string | null,
  extra: { method?: string; balance?: number } = {},
): string {
  return lines(
    `Hi ${first(name)},`,
    "",
    `Thank you for your payment at *${gym.name}*.`,
    "",
    `*Amount:* ${rupees(amount)}`,
    `*Date:* ${fmtDate(date)}`,
    extra.method && METHOD[extra.method] ? `*Mode:* ${METHOD[extra.method]}` : false,
    endDate ? `*Valid till:* ${fmtDate(endDate)}` : false,
    extra.balance && extra.balance > 0 ? `*Balance due:* ${rupees(extra.balance)}` : false,
    "",
    "Keep up the great work!",
  ) + sig(gym);
}

export function birthdayMessage(gym: Gym, name: string): string {
  return lines(
    `Happy Birthday, ${first(name)}!`,
    "",
    "Wishing you a strong, healthy and happy year ahead. Have a great day!",
    "",
    `- Team *${gym.name}*`,
  );
}

type Sub = { plan: string; start: string; end: string; paid: number; balance: number };

export function welcomeMessage(gym: Gym, name: string, x: Sub): string {
  return lines(
    `Hi ${first(name)},`,
    "",
    `*Welcome to ${gym.name}!* We're glad to have you with us.`,
    "",
    `*Plan:* ${x.plan}`,
    `*Valid:* ${fmtDate(x.start)} to ${fmtDate(x.end)}`,
    `*Paid:* ${rupees(x.paid)}`,
    x.balance > 0 ? `*Balance due:* ${rupees(x.balance)}` : false,
    "",
    "A few things to remember:",
    "• Wear proper gym clothes and shoes",
    "• Use the equipment with care",
    "• Membership is non-transferable and non-refundable",
    "",
    "See you at the gym!",
  ) + sig(gym);
}

export function renewalMessage(gym: Gym, name: string, x: Sub): string {
  return lines(
    `Hi ${first(name)},`,
    "",
    `Your *${gym.name}* membership has been renewed. Thank you for staying with us!`,
    "",
    `*Plan:* ${x.plan}`,
    `*Valid till:* ${fmtDate(x.end)}`,
    `*Paid:* ${rupees(x.paid)}`,
    x.balance > 0 ? `*Balance due:* ${rupees(x.balance)}` : false,
    "",
    "Keep up the great work!",
  ) + sig(gym);
}

/** Digits to search with: "+91 98111" → "98111", "0981" → "981". Empty if the query isn't a number. */
export function phoneQuery(raw: string): string {
  const t = raw.trim();
  if (!/\d{3,}/.test(t)) return "";
  let d = t.replace(/\D/g, "");
  if (t.startsWith("+" + CC) || (d.startsWith(CC) && d.length > 10)) d = d.slice(CC.length);
  else if (d.startsWith("00" + CC)) d = d.slice(2 + CC.length);
  else if (d.startsWith("0")) d = d.slice(1);
  return d;
}
