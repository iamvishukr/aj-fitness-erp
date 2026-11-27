import Link from "next/link";
import { logout, logoutEverywhere, removeDemoData, updateProfile } from "@/app/actions";
import { one } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getGymInfo } from "@/lib/data";
import { SimpleForm } from "@/components/forms";
import { ConfirmForm } from "@/components/client";
import { Icon } from "@/components/ui";

export const metadata = { title: "More" };

const links = [
  { href: "/reminders", label: "WhatsApp reminders", sub: "Automatic expiry & dues messages" },
  { href: "/attendance", label: "Attendance & check-in", sub: "Mark today's visits" },
  { href: "/plans", label: "Membership plans", sub: "Durations and prices" },
  { href: "/members?f=dues", label: "Pending dues", sub: "Members who owe money" },
  { href: "/api/export", label: "Export members (CSV)", sub: "Open in Excel / Google Sheets", download: true },
];

export default async function MorePage() {
  const [admin, gym, demo] = await Promise.all([
    requireAdmin(),
    getGymInfo(),
    one<{ n: number }>("SELECT count(*)::int AS n FROM members WHERE is_demo"),
  ]);
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-[26px] font-bold leading-tight">Hi {admin.name.split(" ")[0]} 👋</h1>
        <p className="text-sm text-muted mt-0.5">{gym.name} · Admin</p>
      </header>
      <div className="card divide-y divide-line">
        {links.map((l) =>
          l.download ? (
            <a key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1">
                <div className="font-semibold">{l.label}</div>
                <div className="text-[12px] text-muted">{l.sub}</div>
              </div>
              <span className="text-muted">{Icon.chevron}</span>
            </a>
          ) : (
            <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5">
              <div className="flex-1">
                <div className="font-semibold">{l.label}</div>
                <div className="text-[12px] text-muted">{l.sub}</div>
              </div>
              <span className="text-muted">{Icon.chevron}</span>
            </Link>
          ),
        )}
      </div>

      <section className="card p-4">
        <h2 className="section-title mb-3">Gym details</h2>
        <SimpleForm action={updateProfile} submit="Save" resetOnSuccess={false}>
          <div>
            <label className="label" htmlFor="gym_address">Gym address</label>
            <input id="gym_address" name="gym_address" defaultValue={gym.address} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="gym_phone">Gym phone (shown in WhatsApp messages)</label>
            <input id="gym_phone" name="gym_phone" type="tel" defaultValue={gym.phone} className="input tnum" />
          </div>
        </SimpleForm>
      </section>

      {demo && demo.n > 0 && (
        <ConfirmForm action={removeDemoData} message={`Remove ${demo.n} demo members and their records?`}>
          <button className="btn-danger w-full">Remove demo data ({demo.n} members)</button>
        </ConfirmForm>
      )}

      <section className="space-y-2">
        <form action={logout}>
          <button className="btn-ghost w-full">Sign out</button>
        </form>
        <ConfirmForm action={logoutEverywhere} message="Sign out of every phone and computer?">
          <button className="w-full text-sm text-bad py-2">Sign out of all devices</button>
        </ConfirmForm>
      </section>
    </div>
  );
}
