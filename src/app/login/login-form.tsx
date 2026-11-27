"use client";

import { useState } from "react";
import { useFormAction } from "@/components/forms";
import { login } from "../actions";
import { SubmitButton } from "@/components/client";

export function LoginForm() {
  const { state, onSubmit, pending } = useFormAction(login);
  const [show, setShow] = useState(false);
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {state?.error && (
        <div role="alert" className="rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-sm text-bad">
          {state.error}
        </div>
      )}
      <div>
        <label htmlFor="email" className="label">Email</label>
        <input id="email" name="email" type="email" autoComplete="username" required className="input" placeholder="admin@ajfitness.com" />
      </div>
      <div>
        <label htmlFor="password" className="label">Password</label>
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            autoComplete="current-password"
            required
            className="input pr-16"
          />
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-xs font-semibold text-muted"
          >
            {show ? "Hide" : "Show"}
          </button>
        </div>
      </div>
      <SubmitButton pending={pending} pendingText="Signing in…">Sign in</SubmitButton>
    </form>
  );
}
