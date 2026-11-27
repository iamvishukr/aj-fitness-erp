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

export function waLink(phone: string, text: string): string {
  return `https://wa.me/${waNumber(phone)}?text=${encodeURIComponent(text)}`;
}

export function telLink(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

export type Gym = { name: string; address?: string; phone?: string };
const sig = (g: Gym) =>
  `\n\n— ${g.name}${g.address ? `, ${g.address}` : ""}${g.phone ? `\n📞 ${g.phone}` : ""}`;

type Ctx = { gym: Gym; name: string; endDate: string | null; daysLeft: number | null; due: number; plan?: string | null };

export function reminderMessage(c: Ctx): string {
  return reminderBody(c) + sig(c.gym);
}

function reminderBody(c: Ctx): string {
  const gymName = c.gym.name;
  const first = c.name.split(" ")[0];
  if (c.daysLeft === null || !c.endDate) {
    return `Hi ${first}, this is ${gymName}. We'd love to see you back! Reply to know our current membership plans. 💪`;
  }
  const dueLine = c.due > 0 ? ` You also have a pending balance of ${rupees(c.due)}.` : "";
  if (c.daysLeft < 0) {
    return `Hi ${first}, your ${gymName} membership expired on ${fmtDate(c.endDate)}.${dueLine} Renew today to continue your training. 💪`;
  }
  if (c.daysLeft === 0) {
    return `Hi ${first}, your ${gymName} membership expires today (${fmtDate(c.endDate)}).${dueLine} Please renew to avoid a break in your workouts. 💪`;
  }
  return `Hi ${first}, a reminder from ${gymName}: your membership${c.plan ? ` (${c.plan})` : ""} expires on ${fmtDate(c.endDate)} — ${c.daysLeft} day${c.daysLeft === 1 ? "" : "s"} left.${dueLine} Renew early to keep going! 💪`;
}

export function dueMessage(gym: Gym, name: string, due: number): string {
  return `Hi ${name.split(" ")[0]}, this is a gentle reminder from ${gym.name} that ${rupees(due)} is pending on your membership. You can pay at the front desk or via UPI. Thank you!${sig(gym)}`;
}

export function receiptMessage(gym: Gym, name: string, amount: number, date: string, endDate: string | null): string {
  return `Hi ${name.split(" ")[0]}, we received ${rupees(amount)} on ${fmtDate(date)} at ${gym.name}.${
    endDate ? ` Your membership is valid till ${fmtDate(endDate)}.` : ""
  } Thank you! 🙏${sig(gym)}`;
}

export function birthdayMessage(gym: Gym, name: string): string {
  return `Happy Birthday ${name.split(" ")[0]}! 🎉 Wishing you a strong and healthy year ahead. — Team ${gym.name}`;
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
