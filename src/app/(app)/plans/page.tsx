import { requireAdmin } from "@/lib/auth";
import { createPlan, togglePlan, updatePlan } from "@/app/actions";
import { getPlans } from "@/lib/data";
import { SimpleForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Plans" };

function Fields({ d }: { d?: { name: string; duration_days: number; price: number } }) {
  return (
    <div className="grid grid-cols-[1fr_80px_100px] gap-2">
      <div>
        <label className="label">Name</label>
        <input name="name" required defaultValue={d?.name} className="input" placeholder="Monthly" />
      </div>
      <div>
        <label className="label">Days</label>
        <input name="duration_days" type="number" inputMode="numeric" min={1} required defaultValue={d?.duration_days} className="input tnum" placeholder="30" />
      </div>
      <div>
        <label className="label">Price ₹</label>
        <input name="price" type="number" inputMode="numeric" min={0} required defaultValue={d?.price} className="input tnum" placeholder="1000" />
      </div>
    </div>
  );
}

export default async function PlansPage() {
  await requireAdmin();
  const plans = await getPlans();
  return (
    <div className="space-y-5">
      <PageHeader title="Membership plans" back="/more" />
      {plans.map((p) => (
        <div key={p.id} className={`card p-4 ${p.active ? "" : "opacity-60"}`}>
          <SimpleForm action={updatePlan.bind(null, p.id)} submit="Save" className="space-y-3">
            <Fields d={p} />
          </SimpleForm>
          <form action={togglePlan.bind(null, p.id)} className="mt-2">
            <button className="w-full text-sm text-muted py-1.5">{p.active ? "Hide from new admissions" : "Show again"}</button>
          </form>
        </div>
      ))}
      <div className="card p-4 border-dashed">
        <h2 className="section-title mb-3">Add a plan</h2>
        <SimpleForm action={createPlan} submit="Add plan" className="space-y-3">
          <Fields />
        </SimpleForm>
      </div>
      <p className="text-[12px] text-muted text-center">Editing a plan doesn&apos;t change memberships already sold.</p>
    </div>
  );
}
