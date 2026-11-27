import { requireAdmin } from "@/lib/auth";
import Link from "next/link";
import { getGymName, getMemberSummaries, type MemberSummary } from "@/lib/data";
import { phoneQuery, reminderMessage, waLink } from "@/lib/contact";
import { MemberRow } from "@/components/member-row";
import { Empty, Icon, PageHeader } from "@/components/ui";

export const metadata = { title: "Members" };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "expiring", label: "Expiring" },
  { key: "expired", label: "Expired" },
  { key: "dues", label: "Dues" },
  { key: "none", label: "No plan" },
] as const;

function apply(f: string, list: MemberSummary[]) {
  switch (f) {
    case "active":
      return list.filter((m) => m.status === "active" || m.status === "expiring");
    case "expiring":
      return list.filter((m) => m.status === "expiring").sort((a, b) => a.daysLeft! - b.daysLeft!);
    case "expired":
      return list.filter((m) => m.status === "expired").sort((a, b) => b.daysLeft! - a.daysLeft!);
    case "dues":
      return list.filter((m) => m.due > 0).sort((a, b) => b.due - a.due);
    case "none":
      return list.filter((m) => m.status === "none");
    default:
      return list;
  }
}

export default async function MembersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  await requireAdmin();
  const { q = "", f = "all" } = await searchParams;
  const [all, gym] = await Promise.all([getMemberSummaries(), getGymName()]);
  const needle = q.trim().toLowerCase();
  const digits = phoneQuery(needle);
  const searched = needle
    ? all.filter((m) => m.name.toLowerCase().includes(needle) || (digits !== "" && m.phone.includes(digits)))
    : all;
  const list = apply(f, searched);
  const counts = Object.fromEntries(FILTERS.map((x) => [x.key, apply(x.key, searched).length]));
  const showWa = f === "expiring" || f === "expired" || f === "dues";

  return (
    <div>
      <PageHeader
        title="Members"
        subtitle={`${all.length} total`}
        action={
          <Link href="/members/new" className="btn-primary px-3.5 py-2.5 text-sm">
            {Icon.plus} Add
          </Link>
        }
      />
      <form className="relative mb-3" role="search">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted">{Icon.search}</span>
        <input name="q" defaultValue={q} placeholder="Search name or phone" className="input pl-10" type="search" enterKeyHint="search" />
        {f !== "all" && <input type="hidden" name="f" value={f} />}
      </form>
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 pb-3">
        {FILTERS.map((x) => {
          const params = new URLSearchParams();
          if (q) params.set("q", q);
          if (x.key !== "all") params.set("f", x.key);
          const on = f === x.key;
          return (
            <Link
              key={x.key}
              href={`/members${params.size ? `?${params}` : ""}`}
              className={`shrink-0 chip px-3 py-1.5 text-[13px] border ${on ? "bg-ink text-bg border-ink" : "bg-surface text-muted border-line"}`}
            >
              {x.label} <span className="tnum opacity-70">{counts[x.key]}</span>
            </Link>
          );
        })}
      </div>
      {list.length === 0 ? (
        <Empty>{needle ? `No members match “${q}”.` : "No members in this list."}</Empty>
      ) : (
        <div className="card divide-y divide-line">
          {list.map((m) => (
            <MemberRow
              key={m.id}
              m={m}
              waHref={
                showWa
                  ? waLink(m.phone, reminderMessage({ gym, name: m.name, endDate: m.end_date, daysLeft: m.daysLeft, due: m.due, plan: m.plan_name }))
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
