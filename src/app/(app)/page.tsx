import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import {
  EXPIRING_WINDOW,
  getGymInfo,
  getMemberSummaries,
  getMonthlyRevenue,
  getRevenue,
  getTodayCheckins,
  type MemberSummary,
} from "@/lib/data";
import { addDays, fmtDate, monthStart, rupees, todayISO } from "@/lib/dates";
import { birthdayMessage, reminderMessage, waLink } from "@/lib/contact";
import { MemberRow } from "@/components/member-row";
import { getSetting } from "@/lib/data";
import { loadDemoData } from "@/app/actions";
import { SubmitButton } from "@/components/client";
import { Tabs } from "@/components/tabs";
import { Avatar, Icon } from "@/components/ui";
import { Wordmark } from "@/components/wordmark";

export const metadata = { title: "Dashboard" };

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: process.env.GYM_TIMEZONE || "Asia/Kolkata" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const admin = await requireAdmin();
  const today = todayISO();
  const prevMonthEnd = addDays(monthStart(today), -1);
  const [gym, members, monthRev, todayRev, lastMonthRev, chart, checkins] = await Promise.all([
    getGymInfo(),
    getMemberSummaries(),
    getRevenue(monthStart(today), today),
    getRevenue(today, today),
    getRevenue(monthStart(prevMonthEnd), prevMonthEnd),
    getMonthlyRevenue(6),
    getTodayCheckins(),
  ]);
  const defaultPassword = (await getSetting("default_password")) === "1";

  const active = members.filter((m) => m.status === "active" || m.status === "expiring");
  const expiring = members.filter((m) => m.status === "expiring");
  const expired = members.filter((m) => m.status === "expired");
  const withDues = members.filter((m) => m.due > 0);
  const duesTotal = withDues.reduce((a, m) => a + m.due, 0);

  const remind = (m: MemberSummary) =>
    waLink(m.phone, reminderMessage({ gym, name: m.name, endDate: m.end_date, daysLeft: m.daysLeft, due: m.due, plan: m.plan_name }));

  const bucket = (pred: (d: number) => boolean) =>
    members.filter((m) => m.daysLeft !== null && pred(m.daysLeft)).sort((a, b) => a.daysLeft! - b.daysLeft!);
  const timeline = [
    { key: "y", label: "Yesterday", items: bucket((d) => d === -1) },
    { key: "t", label: "Today", items: bucket((d) => d === 0) },
    { key: "tm", label: "Tomorrow", items: bucket((d) => d === 1) },
    { key: "w", label: `2–${EXPIRING_WINDOW} days`, items: bucket((d) => d >= 2 && d <= EXPIRING_WINDOW) },
    { key: "l", label: "Lapsed 30d", items: bucket((d) => d < -1 && d >= -30).reverse() },
  ];

  const md = today.slice(5);
  const birthdays = members.filter((m) => m.dob && m.dob.slice(5) === md);
  const recent = [...members].sort((a, b) => (a.joined_on < b.joined_on ? 1 : -1)).slice(0, 5);
  const max = Math.max(1, ...chart.map((c) => c.total));
  const change = lastMonthRev.total ? Math.round(((monthRev.total - lastMonthRev.total) / lastMonthRev.total) * 100) : null;

  const stats = [
    { label: "Active members", value: active.length, href: "/members?f=active", tone: "text-ok" },
    { label: `Expiring ≤ ${EXPIRING_WINDOW} days`, value: expiring.length, href: "/members?f=expiring", tone: "text-warn" },
    { label: "Expired", value: expired.length, href: "/members?f=expired", tone: "text-bad" },
    { label: `Dues · ${withDues.length} members`, value: rupees(duesTotal), href: "/members?f=dues", tone: "text-ink" },
  ];

  return (
    <div className="space-y-6">
      <header>
        <div className="flex items-center justify-between">
          <Wordmark size={20} />
          <Link href="/members" className="grid place-items-center size-11 rounded-full bg-surface border border-line" aria-label="Search members">
            {Icon.search}
          </Link>
        </div>
        <p className="text-sm text-muted mt-4">{fmtDate(today)}</p>
        <h1 className="text-2xl font-bold mt-0.5">
          {greeting()}, {admin.name.split(" ")[0]}
        </h1>
      </header>

      {defaultPassword && (
        <Link href="/more" className="block rounded-xl border border-bad/40 bg-bad/10 px-3.5 py-3 text-sm text-bad">
          <b>Security:</b> you&apos;re still using the default password. Tap here to change it.
        </Link>
      )}

      <section className="grid grid-cols-2 gap-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="card p-4 active:scale-[.98] transition">
            <div className={`text-[28px] font-bold leading-none tnum ${s.tone}`}>{s.value}</div>
            <div className="text-[12px] text-muted mt-2">{s.label}</div>
          </Link>
        ))}
      </section>

      <section className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="section-title">Collected this month</div>
            <div className="text-3xl font-bold mt-1 tnum">{rupees(monthRev.total)}</div>
            <div className="text-[13px] text-muted mt-1 tnum">
              Today {rupees(todayRev.total)}
              {change !== null && (
                <span className={change >= 0 ? "text-ok" : "text-bad"}>
                  {" · "}
                  {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% vs last month
                </span>
              )}
            </div>
          </div>
          <Link href="/payments" className="text-[13px] font-semibold text-accent-soft">
            Details
          </Link>
        </div>
        <div className="mt-4 grid grid-cols-6 gap-2 items-end h-24" aria-label="Revenue, last 6 months">
          {chart.map((c, i) => (
            <div key={c.ym} className="flex flex-col items-center gap-1.5 h-full justify-end" title={`${c.label}: ${rupees(c.total)}`}>
              <div
                className={`w-full rounded-md ${i === chart.length - 1 ? "bg-accent" : "bg-surface-2 border border-line"}`}
                style={{ height: `${Math.max(4, (c.total / max) * 100)}%` }}
              />
              <span className="text-[10px] text-muted">{c.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Membership expiry</h2>
          <Link href="/members?f=expiring" className="text-[13px] font-semibold text-accent-soft">
            See all
          </Link>
        </div>
        <Tabs
          tabs={timeline.map((t) => ({
            key: t.key,
            label: t.label,
            count: t.items.length,
            content:
              t.items.length === 0 ? (
                <div className="card p-5 text-center text-sm text-muted">Nobody here. 🎉</div>
              ) : (
                <div className="card divide-y divide-line">
                  {t.items.slice(0, 15).map((m) => (
                    <MemberRow key={m.id} m={m} waHref={remind(m)} />
                  ))}
                  {t.items.length > 15 && (
                    <Link href="/members?f=expiring" className="block p-3 text-center text-sm text-accent-soft font-semibold">
                      +{t.items.length - 15} more
                    </Link>
                  )}
                </div>
              ),
          }))}
        />
      </section>

      <section className="grid grid-cols-2 gap-3">
        <Link href="/attendance" className="card p-4">
          <div className="text-[28px] font-bold leading-none tnum">{checkins.length}</div>
          <div className="text-[12px] text-muted mt-2">Check-ins today →</div>
        </Link>
        <Link href="/members" className="card p-4">
          <div className="text-[28px] font-bold leading-none tnum">{members.length}</div>
          <div className="text-[12px] text-muted mt-2">Total members →</div>
        </Link>
      </section>

      {birthdays.length > 0 && (
        <section>
          <h2 className="section-title mb-3">🎂 Birthdays today</h2>
          <div className="card divide-y divide-line">
            {birthdays.map((m) => (
              <div key={m.id} className="flex items-center gap-3 px-3.5 py-3">
                <Avatar name={m.name} size={38} />
                <Link href={`/members/${m.id}`} className="flex-1 font-semibold truncate">
                  {m.name}
                </Link>
                <a
                  href={waLink(m.phone, birthdayMessage(gym, m.name))}
                  target="_blank"
                  rel="noreferrer"
                  className="chip bg-[#25d366]/15 text-[#25d366] py-1.5"
                >
                  {Icon.whatsapp} Wish
                </a>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">Recently joined</h2>
        {recent.length === 0 ? (
          <div className="card p-6 text-center space-y-3">
            <Link href="/members/new" className="block">
              <div className="font-semibold">Add your first member</div>
              <div className="text-sm text-muted mt-1">Tap here or the + button below.</div>
            </Link>
            <form action={loadDemoData}>
              <SubmitButton className="text-sm font-semibold text-accent-soft" pendingText="Loading…">
                or load demo members to explore
              </SubmitButton>
            </form>
          </div>
        ) : (
          <div className="card divide-y divide-line">
            {recent.map((m) => (
              <MemberRow key={m.id} m={m} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
