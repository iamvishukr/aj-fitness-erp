import { getAdmin } from "@/lib/auth";
import { getMemberSummaries } from "@/lib/data";
import { query } from "@/lib/db";
import { todayISO } from "@/lib/dates";

export const dynamic = "force-dynamic";

function csv(v: unknown) {
  const s = v === null || v === undefined ? "" : String(v);
  // Guard against spreadsheet formula injection
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

export async function GET() {
  if (!(await getAdmin())) return new Response("Unauthorized", { status: 401 });
  const rows = await getMemberSummaries();
  const emails = new Map(
    (await query<{ id: number; email: string | null }>("SELECT id, email FROM members")).map((r) => [r.id, r.email]),
  );
  const header = ["ID", "Name", "Phone", "Email", "Gender", "DOB", "Joined", "Plan", "Start", "End", "Status", "Days left", "Due", "Last visit"];
  const lines = [header.join(",")].concat(
    rows.map((m) =>
      [m.id, m.name, m.phone, emails.get(m.id), m.gender, m.dob, m.joined_on, m.plan_name, m.start_date, m.end_date, m.status, m.daysLeft, m.due, m.last_visit]
        .map(csv)
        .join(","),
    ),
  );
  return new Response("﻿" + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="members-${todayISO()}.csv"`,
    },
  });
}
