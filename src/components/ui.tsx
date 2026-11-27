import Link from "next/link";
import type { Status } from "@/lib/data";

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  const hue = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return (
    <div
      className="shrink-0 grid place-items-center rounded-full font-bold text-[#0b0d10]"
      style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 70% 72%)` }}
      aria-hidden
    >
      {initials || "?"}
    </div>
  );
}

const STATUS: Record<Status, { label: string; cls: string }> = {
  active: { label: "Active", cls: "bg-ok/15 text-ok" },
  expiring: { label: "Expiring", cls: "bg-warn/15 text-warn" },
  expired: { label: "Expired", cls: "bg-bad/15 text-bad" },
  none: { label: "No plan", cls: "bg-muted/15 text-muted" },
};

export function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export function PageHeader({
  title,
  back,
  action,
  subtitle,
}: {
  title: string;
  back?: string;
  action?: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      {back && (
        <Link
          href={back}
          className="grid place-items-center size-10 -ml-1 rounded-full bg-surface border border-line text-ink"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
      )}
      <div className="flex-1 min-w-0">
        <h1 className="text-[22px] font-bold leading-tight truncate">{title}</h1>
        {subtitle && <div className="text-sm text-muted mt-0.5">{subtitle}</div>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="card p-6 text-center text-sm text-muted">{children}</div>;
}

export function Notice({ tone = "ok", children }: { tone?: "ok" | "bad" | "warn"; children: React.ReactNode }) {
  const cls = { ok: "bg-ok/10 text-ok border-ok/30", bad: "bg-bad/10 text-bad border-bad/30", warn: "bg-warn/10 text-warn border-warn/30" }[
    tone
  ];
  return <div className={`rounded-xl border px-3.5 py-2.5 text-sm font-medium mb-4 ${cls}`}>{children}</div>;
}

export const Icon = {
  phone: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  whatsapp: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.2-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6l.4-.5c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.1-.3-.2-.6-.3zM12 21.8c-1.8 0-3.5-.5-5-1.4l-.4-.2-3.7 1 1-3.6-.2-.4A9.8 9.8 0 1 1 12 21.8zm8.4-18.2A11.8 11.8 0 0 0 1.7 17.8L0 24l6.3-1.7A11.8 11.8 0 0 0 24 12c0-3.2-1.2-6.1-3.6-8.4z" />
    </svg>
  ),
  chevron: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
      <path d="M9 18l6-6-6-6" />
    </svg>
  ),
  plus: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
};
