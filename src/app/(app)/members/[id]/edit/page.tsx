import { requireAdmin } from "@/lib/auth";
import { notFound } from "next/navigation";
import { deleteMember, updateMember } from "@/app/actions";
import { getMember } from "@/lib/data";
import { todayISO } from "@/lib/dates";
import { MemberForm } from "@/components/forms";
import { ConfirmForm } from "@/components/client";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Edit member" };

export default async function EditMemberPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const id = Number((await params).id);
  const m = Number.isInteger(id) ? await getMember(id) : null;
  if (!m) notFound();
  return (
    <div>
      <PageHeader title="Edit member" back={`/members/${id}`} />
      <MemberForm mode="edit" action={updateMember.bind(null, id)} today={todayISO()} defaults={m} />
      <ConfirmForm
        action={deleteMember.bind(null, id)}
        message={`Delete ${m.name}? This removes all their memberships, payments and attendance. This can't be undone.`}
        className="mt-8"
      >
        <button className="btn-danger w-full">Delete member</button>
      </ConfirmForm>
    </div>
  );
}
