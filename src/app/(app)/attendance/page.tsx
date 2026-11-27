import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { checkIn } from "@/app/actions";
import { getMemberSummaries, getTodayCheckins } from "@/lib/data";
import { fmtDate, todayISO } from "@/lib/dates";
import { phoneQuery } from "@/lib/contact";
import { SubmitButton } from "@/components/client";
import { Avatar, Empty, Icon, PageHeader, StatusBadge } from "@/components/ui";

export const metadata = { title: "Attendance" };

function time(ms: number) {
  return new Date(Number(ms)).toLocaleTimeString("en-IN", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.GYM_TIMEZONE || "Asia/Kolkata",
  });
}

export default async function AttendancePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdmin();
  const { q = "" } = await searchParams;
  const [checkins, members] = await Promise.all([getTodayCheckins(), q ? getMemberSummaries() : Promise.resolve([])]);
  const inToday = new Set(checkins.map((c) => c.member_id));
  const needle = q.trim().toLowerCase();
  const digits = phoneQuery(needle);
  const results = needle
    ? members.filter((m) => m.name.toLowerCase().includes(needle) || (digits && m.phone.includes(digits))).slice(0, 20)
    : [];

  return (
    <div className="space-y-5">
      <PageHeader title="Attendance" subtitle={fmtDate(todayISO())} back="/more" />
      <form className="relative" role="search">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{Icon.search}</span>
        <input name="q" defaultValue={q} placeholder="Find member to check in" className="input pl-10" type="search" autoFocus enterKeyHint="search" />
      </form>
      {needle && (
        <div className="card divide-y divide-line">
          {results.length === 0 && <div className="p-4 text-sm text-muted">No match.</div>}
          {results.map((m) => (
            <div key={m.id} className="flex items-center gap-3 px-3.5 py-3">
              <Avatar name={m.name} size={38} />
              <Link href={`/members/${m.id}`} className="flex-1 min-w-0">
                <div className="font-semibold truncate">{m.name}</div>
                <StatusBadge status={m.status} />
              </Link>
              {inToday.has(m.id) ? (
                <span className="text-sm text-ok font-semibold">✓ In</span>
              ) : (
                <form action={checkIn.bind(null, m.id)}>
                  <SubmitButton className="btn-primary px-3.5 py-2 text-sm" pendingText="…">
                    Check in
                  </SubmitButton>
                </form>
              )}
            </div>
          ))}
        </div>
      )}
      <section>
        <h2 className="section-title mb-3">Checked in today · {checkins.length}</h2>
        {checkins.length === 0 ? (
          <Empty>No check-ins yet today.</Empty>
        ) : (
          <div className="card divide-y divide-line">
            {checkins.map((c) => (
              <Link key={c.id} href={`/members/${c.member_id}`} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={c.name} size={38} />
                <span className="flex-1 font-semibold truncate">{c.name}</span>
                <span className="text-sm text-muted tnum">{time(c.checked_in_ms)}</span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
