import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { checkIn, deleteMembership, deletePayment, extendMembership, undoCheckIn } from "@/app/actions";
import { ExtendForm } from "@/components/forms";
import {
  getAttendanceStats,
  getGymName,
  getMember,
  getMemberSummary,
  getMemberships,
  getPaymentsForMember,
  getRecentVisits,
} from "@/lib/data";
import { diffDays, fmtDate, fmtShort, relativeDays, rupees, todayISO } from "@/lib/dates";
import { dueMessage, receiptMessage, reminderMessage, telLink, waLink } from "@/lib/contact";
import { ConfirmForm, SubmitButton } from "@/components/client";
import { Avatar, Icon, Notice, PageHeader, StatusBadge } from "@/components/ui";

export const metadata = { title: "Member" };

function age(dob: string | null, today: string) {
  if (!dob) return null;
  let a = Number(today.slice(0, 4)) - Number(dob.slice(0, 4));
  if (today.slice(5) < dob.slice(5)) a--;
  return a;
}

export default async function MemberPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string; renewed?: string; paid?: string }>;
}) {
  await requireAdmin();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const [m, s, memberships, payments, stats, visits, gym] = await Promise.all([
    getMember(id),
    getMemberSummary(id),
    getMemberships(id),
    getPaymentsForMember(id),
    getAttendanceStats(id),
    getRecentVisits(id, 30),
    getGymName(),
  ]);
  if (!m || !s) notFound();
  const today = todayISO();
  const cur = memberships[0];
  const total = cur ? diffDays(cur.start_date, cur.end_date) + 1 : 0;
  const used = cur ? Math.min(total, Math.max(0, diffDays(cur.start_date, today) + 1)) : 0;
  const pct = total ? Math.round((used / total) * 100) : 0;
  const lastPayment = payments[0];
  const remind = waLink(m.phone, reminderMessage({ gym, name: m.name, endDate: s.end_date, daysLeft: s.daysLeft, due: s.due, plan: s.plan_name }));
  const visitSet = new Set(visits.map((v) => v.day));
  const last14 = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (13 - i));
    return d.toISOString().slice(0, 10);
  });
  const years = age(m.dob, today);
  const tone = { active: "text-ok", expiring: "text-warn", expired: "text-bad", none: "text-muted" }[s.status];

  return (
    <div className="space-y-5">
      <PageHeader
        title=""
        back="/members"
        action={
          <Link href={`/members/${id}/edit`} className="btn-ghost px-3.5 py-2 text-sm">
            Edit
          </Link>
        }
      />
      {sp.new && <Notice>Member added successfully.</Notice>}
      {sp.renewed && <Notice>Membership renewed. Valid till {fmtDate(s.end_date)}.</Notice>}
      {sp.paid && (
        <Notice>
          Payment of {rupees(Number(sp.paid))} saved.{" "}
          <a
            className="underline"
            target="_blank"
            rel="noreferrer"
            href={waLink(m.phone, receiptMessage(gym, m.name, Number(sp.paid), today, s.end_date))}
          >
            Send receipt on WhatsApp
          </a>
        </Notice>
      )}

      <section className="flex items-center gap-4 -mt-2">
        <Avatar name={m.name} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight">{m.name}</h1>
          <div className="text-sm text-muted tnum">
            {m.phone}
            {m.gender ? ` · ${m.gender}` : ""}
            {years !== null ? ` · ${years} yrs` : ""}
          </div>
          <div className="mt-1.5">
            <StatusBadge status={s.status} />
          </div>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        <a href={telLink(m.phone)} className="btn-ghost">
          {Icon.phone} Call
        </a>
        <a href={remind} target="_blank" rel="noreferrer" className="btn bg-[#25d366]/15 text-[#25d366] border border-[#25d366]/30">
          {Icon.whatsapp} Remind
        </a>
      </section>

      <section className="card p-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="section-title">Current membership</div>
            <div className="text-lg font-bold mt-1">{cur ? cur.plan_name : "No membership yet"}</div>
          </div>
          {s.daysLeft !== null && (
            <div className="text-right">
              <div className={`text-2xl font-bold tnum ${tone}`}>{s.daysLeft < 0 ? -s.daysLeft : s.daysLeft}</div>
              <div className="text-[11px] text-muted">{s.daysLeft < 0 ? "days since expiry" : "days left"}</div>
            </div>
          )}
        </div>
        {cur && (
          <>
            <div className="mt-3 h-2 rounded-full bg-surface-2 overflow-hidden">
              <div
                className={`h-full rounded-full ${s.status === "expired" ? "bg-bad" : s.status === "expiring" ? "bg-warn" : "bg-ok"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="flex justify-between text-[12px] text-muted mt-1.5 tnum">
              <span>{fmtDate(cur.start_date)}</span>
              <span>{fmtDate(cur.end_date)}</span>
            </div>
          </>
        )}
        <div className="grid grid-cols-2 gap-2 mt-4">
          <Link href={`/members/${id}/renew`} className="btn-primary">
            {cur ? "Renew" : "Add plan"}
          </Link>
          <Link href={`/members/${id}/pay`} className="btn-ghost">
            Record payment
          </Link>
        </div>
        {cur && <ExtendForm action={extendMembership.bind(null, id)} />}
      </section>

      <section className="grid grid-cols-3 gap-2">
        <div className="card p-3">
          <div className={`text-lg font-bold tnum ${s.due > 0 ? "text-bad" : "text-ok"}`}>{rupees(Math.abs(s.due))}</div>
          <div className="text-[11px] text-muted">{s.due < 0 ? "Advance paid" : "Balance due"}</div>
        </div>
        <div className="card p-3">
          <div className="text-lg font-bold tnum">{stats.month}</div>
          <div className="text-[11px] text-muted">Visits this month</div>
        </div>
        <div className="card p-3">
          <div className="text-lg font-bold tnum">{s.last_visit ? fmtShort(s.last_visit) : "—"}</div>
          <div className="text-[11px] text-muted">Last visit</div>
        </div>
      </section>

      {s.due > 0 && (
        <a
          href={waLink(m.phone, dueMessage(gym, m.name, s.due))}
          target="_blank"
          rel="noreferrer"
          className="block text-center text-sm font-semibold text-[#25d366]"
        >
          Send payment reminder for {rupees(s.due)} →
        </a>
      )}

      <section className="card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Attendance · last 14 days</h2>
          <span className="text-[12px] text-muted tnum">{stats.total} total</span>
        </div>
        <div className="grid grid-cols-14 gap-1" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
          {last14.map((d) => (
            <div
              key={d}
              title={fmtDate(d)}
              className={`aspect-square rounded-[5px] ${visitSet.has(d) ? "bg-accent" : "bg-surface-2 border border-line"}`}
            />
          ))}
        </div>
        <div className="mt-4">
          {stats.today ? (
            <form action={undoCheckIn.bind(null, id)} className="flex items-center justify-between">
              <span className="text-sm text-ok font-semibold">✓ Checked in today</span>
              <SubmitButton className="text-sm text-muted underline" pendingText="…">
                Undo
              </SubmitButton>
            </form>
          ) : (
            <form action={checkIn.bind(null, id)} className="space-y-2">
              {(s.status === "expired" || s.status === "none") && (
                <p className="text-[13px] text-bad">⚠ No active membership — renew before letting them train.</p>
              )}
              <SubmitButton className="btn-ghost w-full" pendingText="Checking in…">
                {s.status === "expired" || s.status === "none" ? "Check in anyway" : "Mark check-in for today"}
              </SubmitButton>
            </form>
          )}
        </div>
      </section>

      {(m.health_notes || m.address || m.emergency_contact || m.notes || m.height_cm || m.weight_kg) && (
        <section className="card p-4 space-y-2.5 text-sm">
          <h2 className="section-title mb-1">Details</h2>
          {m.health_notes && (
            <div className="rounded-lg bg-warn/10 text-warn px-3 py-2">
              <span className="font-semibold">Health: </span>
              {m.health_notes}
            </div>
          )}
          {(m.height_cm || m.weight_kg) && (
            <Row k="Body" v={[m.height_cm && `${m.height_cm} cm`, m.weight_kg && `${Number(m.weight_kg)} kg`].filter(Boolean).join(" · ")} />
          )}
          {m.address && <Row k="Address" v={m.address} />}
          {m.emergency_contact && <Row k="Emergency" v={m.emergency_contact} />}
          {m.notes && <Row k="Notes" v={m.notes} />}
        </section>
      )}

      <section>
        <h2 className="section-title mb-3">Membership history</h2>
        <div className="card divide-y divide-line">
          {memberships.length === 0 && <div className="p-4 text-sm text-muted">None yet.</div>}
          {memberships.map((ms) => (
            <div key={ms.id} className="flex items-center gap-3 px-3.5 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold">{ms.plan_name}</div>
                <div className="text-[12px] text-muted tnum">
                  {fmtShort(ms.start_date)} → {fmtDate(ms.end_date)}
                </div>
                {ms.extra_days > 0 && (
                  <div className="text-[11px] text-warn">
                    +{ms.extra_days} days extended{ms.extra_note ? ` · ${ms.extra_note}` : ""}
                  </div>
                )}
              </div>
              <div className="text-right text-sm tnum">
                <div className="font-semibold">{rupees(ms.fee - ms.discount)}</div>
                {ms.discount > 0 && <div className="text-[11px] text-muted">−{rupees(ms.discount)} off</div>}
              </div>
              <ConfirmForm action={deleteMembership.bind(null, id, ms.id)} message={`Remove this ${ms.plan_name} membership entry? Payments already recorded will stay and count as advance.`}>
                <button aria-label="Remove membership" className="text-muted px-1.5 text-lg leading-none">×</button>
              </ConfirmForm>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-3">Payments</h2>
        <div className="card divide-y divide-line">
          {payments.length === 0 && <div className="p-4 text-sm text-muted">No payments recorded.</div>}
          {payments.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-3.5 py-3">
              <div className="flex-1 min-w-0">
                <div className="font-semibold tnum">{rupees(p.amount)}</div>
                <div className="text-[12px] text-muted truncate">
                  {fmtDate(p.paid_on)} · {p.method.toUpperCase()}
                  {p.note ? ` · ${p.note}` : ""}
                </div>
              </div>
              <ConfirmForm action={deletePayment.bind(null, id, p.id)} message={`Delete payment of ${rupees(p.amount)}?`}>
                <button aria-label="Delete payment" className="text-muted px-1.5 text-lg leading-none">×</button>
              </ConfirmForm>
            </div>
          ))}
        </div>
        {lastPayment && (
          <p className="text-[12px] text-muted mt-2">Last paid {relativeDays(diffDays(today, lastPayment.paid_on))}.</p>
        )}
      </section>

      <p className="text-center text-[12px] text-muted">Member since {fmtDate(m.joined_on)}</p>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex gap-3">
      <span className="w-20 shrink-0 text-muted">{k}</span>
      <span className="flex-1">{v}</span>
    </div>
  );
}
