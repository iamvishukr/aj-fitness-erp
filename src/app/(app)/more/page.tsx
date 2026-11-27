import Link from "next/link";
import { changePassword, logout, logoutEverywhere, removeDemoData, updateProfile } from "@/app/actions";
import { one } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getGymInfo } from "@/lib/data";
import { SimpleForm } from "@/components/forms";
import { ConfirmForm } from "@/components/client";
import { Icon, PageHeader } from "@/components/ui";

export const metadata = { title: "More" };

const links = [
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
      <PageHeader title="More" subtitle={admin.email} />
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
        <h2 className="section-title mb-3">Gym & profile</h2>
        <SimpleForm action={updateProfile} submit="Save" resetOnSuccess={false}>
          <div>
            <label className="label" htmlFor="gym_name">Gym name</label>
            <input id="gym_name" name="gym_name" defaultValue={gym.name} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="gym_address">Gym address</label>
            <input id="gym_address" name="gym_address" defaultValue={gym.address} className="input" />
          </div>
          <div>
            <label className="label" htmlFor="gym_phone">Gym phone (shown in WhatsApp messages)</label>
            <input id="gym_phone" name="gym_phone" type="tel" defaultValue={gym.phone} className="input tnum" />
          </div>
          <div>
            <label className="label" htmlFor="aname">Your name</label>
            <input id="aname" name="name" defaultValue={admin.name} required className="input" />
          </div>
          <div>
            <label className="label" htmlFor="aemail">Login email</label>
            <input id="aemail" name="email" type="email" defaultValue={admin.email} required className="input" />
          </div>
        </SimpleForm>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Change password</h2>
        <SimpleForm action={changePassword} submit="Update password">
          <input name="current" type="password" autoComplete="current-password" required placeholder="Current password" className="input" />
          <input name="next" type="password" autoComplete="new-password" required minLength={8} placeholder="New password (min 8)" className="input" />
          <input name="confirm" type="password" autoComplete="new-password" required placeholder="Confirm new password" className="input" />
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
