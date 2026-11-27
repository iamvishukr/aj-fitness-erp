import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { renewMembership } from "@/app/actions";
import { getMemberSummary, getPlans, suggestedRenewalStart } from "@/lib/data";
import { one } from "@/lib/db";
import { fmtDate } from "@/lib/dates";
import { RenewForm } from "@/components/forms";
import { Notice, PageHeader } from "@/components/ui";

export const metadata = { title: "Renew" };

export default async function RenewPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const m = Number.isInteger(id) ? await getMemberSummary(id) : null;
  if (!m) notFound();
  const [plans, last] = await Promise.all([
    getPlans(true),
    one<{ plan_id: number | null }>("SELECT plan_id FROM memberships WHERE member_id=$1 ORDER BY end_date DESC, id DESC LIMIT 1", [id]),
  ]);
  return (
    <div>
      <PageHeader title="Renew membership" subtitle={m.name} back={`/members/${id}`} />
      {m.end_date && (
        <Notice tone={m.status === "expired" ? "bad" : "warn"}>
          Current plan {m.status === "expired" ? "ended" : "ends"} on {fmtDate(m.end_date)}.{" "}
          {m.status !== "expired" ? "New plan starts the day after." : "New plan starts today by default."}
        </Notice>
      )}
      {m.due > 0 && <Notice tone="bad">Previous balance of ₹{m.due.toLocaleString("en-IN")} is still pending.</Notice>}
      <RenewForm action={renewMembership.bind(null, id)} plans={plans} defaultStart={suggestedRenewalStart(m.end_date)} defaultPlanId={last?.plan_id} />
    </div>
  );
}
