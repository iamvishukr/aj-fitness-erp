import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query, one } from "@/lib/db";
import { getGymInfo } from "@/lib/data";
import { whatsappConfigured } from "@/lib/whatsapp";
import { TEMPLATES, getReminderSettings, planReminders, renderTemplate, type ReminderKind } from "@/lib/reminders";
import { runRemindersNow, saveReminderSettingsAction, sendTestReminder } from "@/app/actions";
import { SimpleForm } from "@/components/forms";
import { CopyButton } from "@/components/copy-button";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "WhatsApp reminders" };

const KIND_LABEL: Record<string, string> = { expiring: "Expiring", expired: "Expired", due: "Payment due" };
const STATUS_CLS: Record<string, string> = {
  sent: "bg-ok/15 text-ok",
  failed: "bg-bad/15 text-bad",
  skipped: "bg-muted/15 text-muted",
};

function when(ts: string) {
  return new Date(ts).toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    timeZone: process.env.GYM_TIMEZONE || "Asia/Kolkata",
  });
}

export default async function RemindersPage() {
  await requireAdmin();
  const connected = whatsappConfigured();
  const [settings, gym, lastRunRow, log] = await Promise.all([
    getReminderSettings(),
    getGymInfo(),
    one<{ value: string }>("SELECT value FROM settings WHERE key='reminder_last_run'"),
    query<{ id: number; member_id: number | null; name: string | null; kind: string; status: string; detail: string | null; created_at: string }>(
      `SELECT l.id, l.member_id, m.name, l.kind, l.status, l.detail, l.created_at::text AS created_at
       FROM reminder_log l LEFT JOIN members m ON m.id = l.member_id
       ORDER BY l.created_at DESC LIMIT 40`,
    ),
  ]);
  const plan = await planReminders(settings);
  const lastRun = lastRunRow ? (JSON.parse(lastRunRow.value) as { at: string; sent: number; failed: number; planned: number }) : null;
  const live = connected && settings.enabled;

  return (
    <div className="space-y-5">
      <PageHeader title="WhatsApp reminders" subtitle="Automatic expiry & dues messages" back="/more" />

      <section className={`rounded-2xl border p-4 ${live ? "border-ok/40 bg-ok/10" : "border-warn/40 bg-warn/10"}`}>
        <div className={`font-semibold ${live ? "text-ok" : "text-warn"}`}>
          {live ? "● Active — sending every morning (10–11 am)" : !connected ? "● Not connected to WhatsApp yet" : "● Connected, but automatic sending is off"}
        </div>
        <p className="text-[13px] text-ink/80 mt-1">
          {!connected
            ? "Everything is ready. Once you connect your WhatsApp Business number (steps below), switch it on."
            : live
              ? "Members get their reminder automatically — no need to tap anything."
              : "Turn on “Send automatically” below to start."}
        </p>
        {lastRun && (
          <p className="text-[12px] text-muted mt-2">
            Last run {when(lastRun.at)} · {lastRun.sent} sent · {lastRun.failed} failed · {lastRun.planned} due
          </p>
        )}
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Rules</h2>
        <SimpleForm action={saveReminderSettingsAction} submit="Save rules" resetOnSuccess={false}>
          <Toggle name="enabled" checked={settings.enabled} title="Send automatically" sub="Every morning between 10 and 11 am" />
          <div className="h-px bg-line" />
          <Toggle name="expiring" checked={settings.expiring} title="Before expiry" sub={<>Once, when <Num name="daysBefore" value={settings.daysBefore} /> days or fewer are left</>} />
          <Toggle name="expired" checked={settings.expired} title="After expiry" sub={<>Once, within <Num name="daysAfter" value={settings.daysAfter} /> days after it ends (if not renewed)</>} />
          <Toggle name="due" checked={settings.due} title="Pending dues" sub={<>Every <Num name="dueEvery" value={settings.dueEvery} /> days while money is pending</>} />
          <p className="text-[12px] text-muted">
            Each member gets at most one message a day. Members marked “no automatic reminders” and demo members are never messaged.
          </p>
        </SimpleForm>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="section-title">Due today · {plan.length}</h2>
        </div>
        {plan.length === 0 ? (
          <div className="card p-5 text-center text-sm text-muted">No reminders due today.</div>
        ) : (
          <div className="card divide-y divide-line">
            {plan.slice(0, 25).map((p) => (
              <details key={`${p.member.id}-${p.kind}`} className="px-3.5 py-3">
                <summary className="flex items-center gap-2 cursor-pointer list-none">
                  <span className="flex-1 font-semibold truncate">{p.member.name}</span>
                  <span className="chip bg-surface-2 border border-line text-ink">{KIND_LABEL[p.kind]}</span>
                </summary>
                <p className="mt-2 text-[13px] text-ink/80 rounded-lg bg-surface-2 p-2.5">{renderTemplate(p.kind as ReminderKind, p.member, gym)}</p>
              </details>
            ))}
            {plan.length > 25 && <div className="p-3 text-center text-sm text-muted">+{plan.length - 25} more</div>}
          </div>
        )}
        <SimpleForm action={runRemindersNow} submit={connected ? "Send today’s reminders now" : "Check today’s reminders"} className="mt-3 space-y-3">
          <span />
        </SimpleForm>
      </section>

      <section className="card p-4">
        <h2 className="section-title mb-3">Send a test message</h2>
        <SimpleForm action={sendTestReminder} submit="Send test" resetOnSuccess={false}>
          <input name="phone" type="tel" defaultValue={gym.phone} className="input tnum" placeholder="Your WhatsApp number" />
        </SimpleForm>
      </section>

      <section>
        <h2 className="section-title mb-3">History</h2>
        {log.length === 0 ? (
          <div className="card p-5 text-center text-sm text-muted">Nothing yet.</div>
        ) : (
          <div className="card divide-y divide-line">
            {log.map((l) => (
              <div key={l.id} className="flex items-start gap-3 px-3.5 py-2.5">
                <div className="flex-1 min-w-0">
                  {l.member_id ? (
                    <Link href={`/members/${l.member_id}`} className="font-semibold truncate block">{l.name}</Link>
                  ) : (
                    <span className="text-muted">Deleted member</span>
                  )}
                  <div className="text-[12px] text-muted truncate">
                    {KIND_LABEL[l.kind] ?? l.kind} · {when(l.created_at)}
                    {l.status !== "sent" && l.detail ? ` · ${l.detail}` : ""}
                  </div>
                </div>
                <span className={`chip ${STATUS_CLS[l.status] ?? ""}`}>{l.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card p-4 space-y-4">
        <h2 className="section-title">One-time setup (≈30 min)</h2>
        <ol className="list-decimal pl-5 space-y-2.5 text-sm text-ink/90">
          <li>
            Go to <b>business.facebook.com</b> → create a Meta Business account for {gym.name} (if you don&apos;t have one).
          </li>
          <li>
            Open <b>WhatsApp Manager</b> → <b>Add phone number</b>. To keep using {gym.phone || "your number"} in the WhatsApp Business
            app, choose the option to connect an <b>existing WhatsApp Business app</b> number (“coexistence”) and scan the QR code from the app.
          </li>
          <li>Add a payment method in WhatsApp Manager (≈ ₹0.15 per reminder).</li>
          <li>
            Create the 3 message templates below: <b>Category: Utility</b>, <b>Language: English</b>, exact name and text. Approval usually takes minutes.
          </li>
          <li>
            In Meta Business settings → <b>System users</b>, create a user with access to the WhatsApp account, generate a <b>permanent token</b>
            (permissions: whatsapp_business_messaging, whatsapp_business_management).
          </li>
          <li>
            Send me the <b>Phone number ID</b> (WhatsApp Manager → API setup) and I&apos;ll add it with the token to Vercel as{" "}
            <code className="text-[12px]">WHATSAPP_PHONE_NUMBER_ID</code> and <code className="text-[12px]">WHATSAPP_TOKEN</code>. Then switch on “Send automatically”.
          </li>
        </ol>
        <div className="space-y-3">
          {(Object.keys(TEMPLATES) as ReminderKind[]).map((k) => (
            <div key={k} className="rounded-xl bg-surface-2 border border-line p-3">
              <div className="flex items-center justify-between gap-2">
                <code className="text-[13px] font-semibold">{TEMPLATES[k].name}</code>
                <CopyButton text={TEMPLATES[k].name} label="Copy name" />
              </div>
              <p className="text-[13px] text-ink/80 mt-2 select-all">{TEMPLATES[k].body}</p>
              <div className="mt-2">
                <CopyButton text={TEMPLATES[k].body} label="Copy text" />
              </div>
            </div>
          ))}
        </div>
        <p className="text-[12px] text-muted">
          WhatsApp rules: only message members who agreed to receive updates (the tick on their profile). Members can reply STOP — untick them if
          they do.
        </p>
      </section>
    </div>
  );
}

function Toggle({ name, checked, title, sub }: { name: string; checked: boolean; title: string; sub: React.ReactNode }) {
  return (
    <label className="flex items-start gap-3">
      <input type="checkbox" name={name} value="1" defaultChecked={checked} className="size-5 mt-0.5 accent-[#e3262e]" />
      <span className="flex-1">
        <span className="font-semibold block">{title}</span>
        <span className="text-[13px] text-muted">{sub}</span>
      </span>
    </label>
  );
}

function Num({ name, value }: { name: string; value: number }) {
  return (
    <input
      name={name}
      type="number"
      inputMode="numeric"
      min={0}
      max={60}
      defaultValue={value}
      className="w-12 rounded-md bg-surface-2 border border-line px-1.5 py-0.5 text-center text-ink tnum"
    />
  );
}
