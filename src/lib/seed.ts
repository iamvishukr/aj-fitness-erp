import "server-only";
import { one, query } from "./db";
import { addDays, todayISO } from "./dates";

const NAMES = [
  "Rahul Sharma", "Priya Patel", "Amit Verma", "Sneha Reddy", "Vikram Singh", "Ananya Iyer", "Rohan Gupta",
  "Kavya Nair", "Arjun Mehta", "Pooja Joshi", "Karan Malhotra", "Neha Kapoor", "Siddharth Rao", "Ishita Das",
  "Manish Yadav", "Divya Menon", "Aditya Kulkarni", "Riya Chatterjee", "Harsh Agarwal", "Meera Pillai",
  "Nikhil Bansal", "Tanvi Shah", "Sameer Khan", "Aisha Siddiqui", "Gaurav Mishra", "Shreya Ghosh",
];

export async function seedDemo() {
  const plans = await query<{ id: number; name: string; duration_days: number; price: number }>(
    "SELECT id, name, duration_days, price FROM plans WHERE active ORDER BY duration_days",
  );
  if (!plans.length) return;
  const today = todayISO();
  let r = 7;
  const rand = () => ((r = (r * 9301 + 49297) % 233280) / 233280);
  // offsets in days from today for membership end date → spread across states
  const endOffsets = [-20, -9, -3, -1, -1, 0, 0, 1, 2, 3, 5, 6, 9, 14, 20, 25, 33, 41, 55, 70, 88, 120, 150, 200, 240, -45];
  for (let i = 0; i < NAMES.length; i++) {
    const plan = plans[i % plans.length];
    const end = addDays(today, endOffsets[i]);
    const start = addDays(end, -(plan.duration_days - 1));
    const joined = addDays(start, -Math.floor(rand() * 200));
    const dob = i === 4 ? `199${i % 10}-${today.slice(5)}` : `19${85 + (i % 15)}-${String(1 + (i % 12)).padStart(2, "0")}-${String(1 + ((i * 7) % 28)).padStart(2, "0")}`;
    const phone = "9" + String(800000000 + i * 1234567).slice(0, 9);
    const m = await one<{ id: number }>(
      `INSERT INTO members (name, phone, gender, dob, joined_on, height_cm, weight_kg, health_notes, is_demo)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,true) RETURNING id`,
      [NAMES[i], phone, i % 2 ? "Female" : "Male", dob, joined, 155 + (i % 30), 55 + (i % 35), i % 9 === 0 ? "Lower back pain" : null],
    );
    const discount = i % 5 === 0 ? Math.round(plan.price * 0.1) : 0;
    const ms = await one<{ id: number }>(
      `INSERT INTO memberships (member_id, plan_id, plan_name, start_date, end_date, fee, discount)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [m!.id, plan.id, plan.name, start, end, plan.price, discount],
    );
    const payable = plan.price - discount;
    const paid = i % 6 === 2 ? Math.round(payable / 2) : payable; // some partial payments → dues
    const paidOn = start < addDays(today, -150) ? addDays(today, -Math.floor(rand() * 150)) : start > today ? today : start;
    await query("INSERT INTO payments (member_id, membership_id, amount, method, paid_on, note) VALUES ($1,$2,$3,$4,$5,$6)", [
      m!.id, ms!.id, paid, ["cash", "upi", "upi", "card"][i % 4], paidOn, `${plan.name} plan`,
    ]);
    // attendance over the last 20 days for those not long expired
    if (endOffsets[i] > -5) {
      for (let d = 0; d < 20; d++) {
        if (rand() < 0.55) {
          await query("INSERT INTO attendance (member_id, day, checked_in_at) VALUES ($1,$2, now() - ($3 || ' days')::interval) ON CONFLICT DO NOTHING", [
            m!.id, addDays(today, -d), String(d),
          ]);
        }
      }
    }
  }
}

export async function removeDemo() {
  await query("DELETE FROM members WHERE is_demo");
}
