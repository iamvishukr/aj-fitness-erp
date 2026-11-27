import { requireAdmin } from "@/lib/auth";
import { createPlan, togglePlan, updatePlan } from "@/app/actions";
import { getPlans } from "@/lib/data";
import { SimpleForm } from "@/components/forms";
import { PageHeader } from "@/components/ui";

export const metadata = { title: "Plans" };

function Fields({ d }: { d?: { name: string; duration_days: number; duration_months: number | null; price: number } }) {
  const unit = d && !d.duration_months ? "days" : "months";
  const length = d ? (d.duration_months ?? d.duration_days) : undefined;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <div>
          <label className="label">Plan name</label>
          <input name="name" required defaultValue={d?.name} className="input" placeholder="One Month" />
        </div>
        <div>
          <label className="label">Price ₹</label>
          <input name="price" type="number" inputMode="numeric" min={0} required defaultValue={d?.price} className="input tnum" placeholder="2000" />
        </div>
      </div>
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <div>
          <label className="label">Length</label>
          <input name="length" type="number" inputMode="numeric" min={1} required defaultValue={length} className="input tnum" placeholder="1" />
        </div>
        <div>
          <label className="label">Unit</label>
          <select name="unit" defaultValue={unit} className="input">
            <option value="months">Months (calendar)</option>
            <option value="days">Days</option>
          </select>
        </div>
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
