import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { recordPayment } from "@/app/actions";
import { getMemberSummary } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { PaymentForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Record payment" };

export default async function PayPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const m = Number.isInteger(id) ? await getMemberSummary(id) : null;
  if (!m) notFound();
  return (
    <div>
      <PageHeader title="Record payment" subtitle={m.name} back={`/members/${id}`} />
      <PaymentForm action={recordPayment.bind(null, id)} due={m.due} today={todayISO()} />
    </div>
  );
}
