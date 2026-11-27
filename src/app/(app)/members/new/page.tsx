import { requireAdmin } from "@/lib/auth";
import { createMember } from "@/app/actions";
import { getPlans } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { MemberForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Add member" };

export default async function NewMemberPage() {
  await requireAdmin();
  const plans = await getPlans(true);
  return (
    <div>
      <PageHeader title="New admission" back="/members" />
      <MemberForm mode="create" action={createMember} plans={plans} today={todayISO()} />
    </div>
  );
}
