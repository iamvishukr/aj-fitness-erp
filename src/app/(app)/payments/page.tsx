import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getPaymentsBetween } from "@/lib/data";
import { addDays, fmtDate, rupees, todayISO } from "@/lib/dates";
import { Empty, PageHeader } from "@/components/ui";

export const metadata = { title: "Payments" };

function monthBounds(ym: string) {
  const from = `${ym}-01`;
  const d = new Date(from + "T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { from, to: addDays(d.toISOString().slice(0, 10), -1) };
}
function shiftMonth(ym: string, n: number) {
  const d = new Date(`${ym}-01T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
}

export default async function PaymentsPage({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  await requireAdmin();
  const today = todayISO();
  const thisMonth = today.slice(0, 7);
  const sp = await searchParams;
  const ym = sp.m && /^\d{4}-\d{2}$/.test(sp.m) && sp.m <= thisMonth ? sp.m : thisMonth;
  const { from, to } = monthBounds(ym);
  const list = await getPaymentsBetween(from, to);
  const total = list.reduce((a, p) => a + p.amount, 0);
  const byMethod = Object.entries(
    list.reduce<Record<string, number>>((a, p) => ((a[p.method] = (a[p.method] || 0) + p.amount), a), {}),
  ).sort((a, b) => b[1] - a[1]);
  const label = new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

  // group by day
  const days = new Map<string, typeof list>();
  for (const p of list) days.set(p.paid_on, [...(days.get(p.paid_on) ?? []), p]);

  return (
    <div>
      <PageHeader title="Payments" />
      <div className="flex items-center justify-between card px-2 py-2 mb-3">
        <Link href={`/payments?m=${shiftMonth(ym, -1)}`} className="px-3 py-2 text-lg" aria-label="Previous month">‹</Link>
        <span className="font-semibold">{label}</span>
        {ym < thisMonth ? (
          <Link href={`/payments?m=${shiftMonth(ym, 1)}`} className="px-3 py-2 text-lg" aria-label="Next month">›</Link>
        ) : (
          <span className="px-3 py-2 text-lg text-line">›</span>
        )}
      </div>
      <div className="card p-4 mb-5">
        <div className="section-title">Collected</div>
        <div className="text-3xl font-bold mt-1 tnum">{rupees(total)}</div>
        <div className="text-[13px] text-muted">{list.length} payments</div>
        {byMethod.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {byMethod.map(([k, v]) => (
              <span key={k} className="chip bg-surface-2 border border-line text-ink tnum">
                {k.toUpperCase()} {rupees(v)}
              </span>
            ))}
          </div>
        )}
      </div>
      {list.length === 0 ? (
        <Empty>No payments in {label}.</Empty>
      ) : (
        <div className="space-y-4">
          {[...days.entries()].map(([day, ps]) => (
            <div key={day}>
              <div className="flex justify-between text-[12px] text-muted mb-1.5 px-1 tnum">
                <span>{day === today ? "Today" : fmtDate(day)}</span>
                <span>{rupees(ps.reduce((a, p) => a + p.amount, 0))}</span>
              </div>
              <div className="card divide-y divide-line">
                {ps.map((p) => (
                  <Link key={p.id} href={`/members/${p.member_id}`} className="flex items-center gap-3 px-3.5 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.member_name}</div>
                      <div className="text-[12px] text-muted truncate">
                        {p.method.toUpperCase()}
                        {p.note ? ` · ${p.note}` : ""}
                      </div>
                    </div>
                    <div className="font-semibold tnum">{rupees(p.amount)}</div>
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <Link href="/members?f=dues" className="block text-center text-sm font-semibold text-accent mt-6">
        View members with pending dues →
      </Link>
    </div>
  );
}
