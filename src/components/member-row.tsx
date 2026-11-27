import Link from "next/link";
import { Avatar, Icon, StatusBadge } from "./ui";
import type { MemberSummary } from "@/lib/data";
import { fmtShort, relativeDays, rupees } from "@/lib/dates";

export function MemberRow({ m, waHref, extra }: { m: MemberSummary; waHref?: string; extra?: React.ReactNode }) {
  const sub =
    m.status === "none"
      ? "No membership"
      : m.status === "expired"
        ? `Expired ${relativeDays(m.daysLeft!)}`
        : m.daysLeft === 0
          ? "Expires today"
          : `Till ${fmtShort(m.end_date)} · ${m.daysLeft}d left`;
  return (
    <div className="flex items-center gap-3 px-3.5 py-3">
      <Link href={`/members/${m.id}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar name={m.name} size={42} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold truncate">{m.name}</span>
          </div>
          <div className="text-[13px] text-muted truncate tnum">
            {m.plan_name ? `${m.plan_name} · ` : ""}
            {sub}
          </div>
        </div>
      </Link>
      <div className="flex flex-col items-end gap-1 shrink-0">
        <StatusBadge status={m.status} />
        {m.due > 0 && <span className="text-[11px] font-semibold text-bad tnum">Due {rupees(m.due)}</span>}
        {m.due < 0 && <span className="text-[11px] font-semibold text-ok tnum">Adv {rupees(-m.due)}</span>}
      </div>
      {extra}
      {waHref && (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          aria-label={`WhatsApp ${m.name}`}
          className="grid place-items-center size-10 rounded-full bg-[#25d366]/15 text-[#25d366] shrink-0"
        >
          {Icon.whatsapp}
        </a>
      )}
    </div>
  );
}
