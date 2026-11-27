"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState } from "react";
import type { FormState } from "@/app/actions";
import { SubmitButton } from "./client";

type Plan = { id: number; name: string; duration_days: number; price: number };
type Action = (state: FormState, fd: FormData) => Promise<FormState>;

/** Like useActionState, but submits via onSubmit so React doesn't reset the form (keeps input on validation errors). */
export function useFormAction(action: Action, resetOnSuccess = false) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (resetOnSuccess && state?.ok) formRef.current?.reset();
  }, [state, resetOnSuccess]);
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return; // ignore double taps
    const fd = new FormData(e.currentTarget);
    startTransition(() => formAction(fd));
  };
  return { state, onSubmit, pending, formRef };
}

export function ErrorBox({ state }: { state: FormState }) {
  if (state?.error)
    return (
      <div role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
        {state.error}
      </div>
    );
  if (state?.ok)
    return (
      <div role="status" className="rounded-xl border border-ok/30 bg-ok/10 px-3.5 py-2.5 text-sm text-ok">
        {state.ok}
      </div>
    );
  return null;
}

function addDays(iso: string, n: number) {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const fmt = (iso: string) =>
  iso ? new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "—";
const inr = (n: number) => "₹" + n.toLocaleString("en-IN");

export const PAYMENT_METHODS = [
  { v: "cash", l: "Cash" },
  { v: "upi", l: "UPI" },
  { v: "card", l: "Card" },
  { v: "bank", l: "Bank" },
  { v: "other", l: "Other" },
];

export function MethodPicker({ name = "method", defaultValue = "cash" }: { name?: string; defaultValue?: string }) {
  const [v, setV] = useState(defaultValue);
  return (
    <div>
      <span className="label">Payment mode</span>
      <input type="hidden" name={name} value={v} />
      <div className="grid grid-cols-5 gap-1.5">
        {PAYMENT_METHODS.map((m) => (
          <button
            key={m.v}
            type="button"
            onClick={() => setV(m.v)}
            className={`rounded-lg py-2.5 text-[13px] font-semibold border ${
              v === m.v ? "bg-accent text-accent-ink border-accent" : "bg-surface-2 text-muted border-line"
            }`}
          >
            {m.l}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SubscriptionFields({
  plans,
  defaultStart,
  defaultPlanId,
}: {
  plans: Plan[];
  defaultStart: string;
  defaultPlanId?: number | null;
}) {
  const [planId, setPlanId] = useState<number>(
    plans.find((p) => p.id === defaultPlanId)?.id ?? plans[0]?.id ?? 0,
  );
  const plan = plans.find((p) => p.id === planId);
  const [start, setStart] = useState(defaultStart);
  const [fee, setFee] = useState<number>(plan?.price ?? 0);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState<number>(plan?.price ?? 0);
  const [paidTouched, setPaidTouched] = useState(false);
  const total = Math.max(0, fee - discount);
  const end = useMemo(() => (plan && start ? addDays(start, plan.duration_days - 1) : ""), [plan, start]);

  if (plans.length === 0)
    return <p className="text-sm text-warn">No active plans. Add one under More → Plans first.</p>;

  return (
    <div className="space-y-4">
      <div>
        <span className="label">Plan</span>
        <input type="hidden" name="plan_id" value={planId} />
        <div className="grid grid-cols-2 gap-2">
          {plans.map((p) => (
            <button
              type="button"
              key={p.id}
              onClick={() => {
                setPlanId(p.id);
                setFee(p.price);
                if (!paidTouched) setPaid(Math.max(0, p.price - discount));
              }}
              className={`rounded-xl border p-3 text-left ${
                p.id === planId ? "border-accent bg-accent/10" : "border-line bg-surface-2"
              }`}
            >
              <div className="font-semibold text-[15px]">{p.name}</div>
              <div className="text-[12px] text-muted tnum">
                {p.duration_days} days · {inr(p.price)}
              </div>
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="start_date">Start date</label>
          <input id="start_date" name="start_date" type="date" required value={start} onChange={(e) => setStart(e.target.value)} className="input" />
        </div>
        <div>
          <span className="label">Valid till</span>
          <div className="input bg-transparent text-ink/90 tnum">{fmt(end)}</div>
        </div>
        <div>
          <label className="label" htmlFor="fee">Fee (₹)</label>
          <input
            id="fee"
            name="fee"
            type="number"
            inputMode="numeric"
            min={0}
            required
            value={fee}
            onChange={(e) => {
              const v = Number(e.target.value || 0);
              setFee(v);
              if (!paidTouched) setPaid(Math.max(0, v - discount));
            }}
            className="input tnum"
          />
        </div>
        <div>
          <label className="label" htmlFor="discount">Discount (₹)</label>
          <input
            id="discount"
            name="discount"
            type="number"
            inputMode="numeric"
            min={0}
            value={discount}
            onChange={(e) => {
              const v = Number(e.target.value || 0);
              setDiscount(v);
              if (!paidTouched) setPaid(Math.max(0, fee - v));
            }}
            className="input tnum"
          />
        </div>
      </div>
      <div className="rounded-xl bg-surface-2 border border-line p-3.5 space-y-3">
        <div className="flex justify-between text-sm">
          <span className="text-muted">Payable</span>
          <span className="font-bold tnum">{inr(total)}</span>
        </div>
        <div>
          <label className="label" htmlFor="paid">Paid now (₹)</label>
          <input
            id="paid"
            name="paid"
            type="number"
            inputMode="numeric"
            min={0}
            value={paid}
            onChange={(e) => {
              setPaidTouched(true);
              setPaid(Number(e.target.value || 0));
            }}
            className="input tnum"
          />
        </div>
        {paid < total && <div className="text-[13px] text-warn tnum">Balance due: {inr(total - paid)}</div>}
        {paid > total && <div className="text-[13px] text-ok tnum">Advance: {inr(paid - total)} (kept as credit)</div>}
        <MethodPicker />
      </div>
    </div>
  );
}

type MemberDefaults = Partial<{
  name: string;
  phone: string;
  gender: string | null;
  dob: string | null;
  address: string | null;
  emergency_contact: string | null;
  height_cm: number | null;
  weight_kg: string | number | null;
  health_notes: string | null;
  notes: string | null;
  joined_on: string;
}>;

export function MemberForm({
  action,
  plans,
  today,
  defaults = {},
  mode,
}: {
  action: Action;
  plans?: Plan[];
  today: string;
  defaults?: MemberDefaults;
  mode: "create" | "edit";
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  const [gender, setGender] = useState(defaults.gender ?? "");
  const [more, setMore] = useState(mode === "edit");
  const d = defaults;
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <ErrorBox state={state} />
      <div className="card p-4 space-y-4">
        <div>
          <label className="label" htmlFor="name">Full name *</label>
          <input id="name" name="name" required defaultValue={d.name} className="input" autoComplete="off" placeholder="e.g. Rahul Sharma" />
        </div>
        <div>
          <label className="label" htmlFor="phone">Mobile number *</label>
          <input id="phone" name="phone" required defaultValue={d.phone} className="input tnum" type="tel" inputMode="tel" placeholder="98765 43210" />
        </div>
        <div>
          <span className="label">Gender</span>
          <input type="hidden" name="gender" value={gender} />
          <div className="grid grid-cols-3 gap-2">
            {["Male", "Female", "Other"].map((g) => (
              <button
                key={g}
                type="button"
                onClick={() => setGender(gender === g ? "" : g)}
                className={`rounded-lg py-2.5 text-sm font-semibold border ${
                  gender === g ? "bg-accent text-accent-ink border-accent" : "bg-surface-2 text-muted border-line"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="dob">Date of birth</label>
            <input id="dob" name="dob" type="date" defaultValue={d.dob ?? ""} className="input" max={today} />
          </div>
          <div>
            <label className="label" htmlFor="joined_on">Joining date *</label>
            <input id="joined_on" name="joined_on" type="date" required defaultValue={d.joined_on ?? today} className="input" />
          </div>
        </div>

        {!more ? (
          <button type="button" onClick={() => setMore(true)} className="text-sm font-semibold text-accent">
            + Address, emergency contact, health details
          </button>
        ) : (
          <>
            <div>
              <label className="label" htmlFor="address">Address</label>
              <input id="address" name="address" defaultValue={d.address ?? ""} className="input" />
            </div>
            <div>
              <label className="label" htmlFor="emergency_contact">Emergency contact</label>
              <input id="emergency_contact" name="emergency_contact" defaultValue={d.emergency_contact ?? ""} className="input" placeholder="Name & number" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="height_cm">Height (cm)</label>
                <input id="height_cm" name="height_cm" type="number" inputMode="decimal" min={50} max={250} step="any" defaultValue={d.height_cm ?? ""} className="input" />
              </div>
              <div>
                <label className="label" htmlFor="weight_kg">Weight (kg)</label>
                <input id="weight_kg" name="weight_kg" type="number" inputMode="decimal" min={10} max={300} step="0.1" defaultValue={d.weight_kg ? Number(d.weight_kg) : ""} className="input" />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="health_notes">Health conditions / injuries</label>
              <input id="health_notes" name="health_notes" defaultValue={d.health_notes ?? ""} className="input" placeholder="e.g. knee injury, BP" />
            </div>
            <div>
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" name="notes" defaultValue={d.notes ?? ""} rows={2} className="input" />
            </div>
          </>
        )}
      </div>

      {mode === "create" && plans && (
        <div className="card p-4">
          <h2 className="section-title mb-3">Membership & payment</h2>
          <SubscriptionFields plans={plans} defaultStart={today} />
        </div>
      )}

      {mode === "create" && (
        <label className="flex items-center gap-2 text-sm text-muted">
          <input type="checkbox" name="allow_duplicate" value="1" className="size-4 accent-[#d4ff3a]" />
          Same phone is OK (e.g. family members)
        </label>
      )}
      <SubmitButton pending={pending}>{mode === "create" ? "Add member" : "Save changes"}</SubmitButton>
    </form>
  );
}

export function RenewForm({
  action,
  plans,
  defaultStart,
  defaultPlanId,
}: {
  action: Action;
  plans: Plan[];
  defaultStart: string;
  defaultPlanId?: number | null;
}) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <ErrorBox state={state} />
      <div className="card p-4">
        <SubscriptionFields plans={plans} defaultStart={defaultStart} defaultPlanId={defaultPlanId} />
      </div>
      <SubmitButton pending={pending}>Renew membership</SubmitButton>
    </form>
  );
}

export function PaymentForm({ action, due, today }: { action: Action; due: number; today: string }) {
  const { state, onSubmit, pending } = useFormAction(action);
  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <ErrorBox state={state} />
      <div className="card p-4 space-y-4">
        {due > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted">Outstanding</span>
            <span className="font-bold text-bad tnum">{inr(due)}</span>
          </div>
        )}
        <div>
          <label className="label" htmlFor="amount">Amount (₹) *</label>
          <input id="amount" name="amount" type="number" inputMode="numeric" min={1} required defaultValue={due > 0 ? due : ""} className="input text-xl font-bold tnum" />
        </div>
        <div>
          <label className="label" htmlFor="paid_on">Date</label>
          <input id="paid_on" name="paid_on" type="date" required defaultValue={today} max={today} className="input" />
        </div>
        <MethodPicker />
        <div>
          <label className="label" htmlFor="note">Note</label>
          <input id="note" name="note" className="input" placeholder="Optional (e.g. UPI ref, locker fee)" />
        </div>
      </div>
      <SubmitButton pending={pending}>Save payment</SubmitButton>
    </form>
  );
}

export function SimpleForm({
  action,
  children,
  submit,
  className = "space-y-4",
  resetOnSuccess = true,
}: {
  action: Action;
  children: React.ReactNode;
  submit: string;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const { state, onSubmit, pending, formRef } = useFormAction(action, resetOnSuccess);
  return (
    <form ref={formRef} onSubmit={onSubmit} className={className}>
      <ErrorBox state={state} />
      {children}
      <SubmitButton pending={pending}>{submit}</SubmitButton>
    </form>
  );
}

export function ExtendForm({ action }: { action: Action }) {
  const [open, setOpen] = useState(false);
  const { state, onSubmit, pending, formRef } = useFormAction(action, true);
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="w-full text-[13px] font-semibold text-muted mt-3">
        Freeze / extend days
      </button>
    );
  return (
    <form ref={formRef} onSubmit={onSubmit} className="mt-4 space-y-3 rounded-xl bg-surface-2 border border-line p-3">
      <ErrorBox state={state} />
      <div className="grid grid-cols-[90px_1fr] gap-2">
        <div>
          <label className="label" htmlFor="days">Add days</label>
          <input id="days" name="days" type="number" inputMode="numeric" min={1} max={365} required className="input tnum" placeholder="7" />
        </div>
        <div>
          <label className="label" htmlFor="reason">Reason</label>
          <input id="reason" name="reason" className="input" placeholder="Travel, illness, gym closed…" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <button type="button" onClick={() => setOpen(false)} className="btn-ghost">
          Close
        </button>
        <SubmitButton pending={pending} className="btn-primary">
          Extend
        </SubmitButton>
      </div>
    </form>
  );
}
