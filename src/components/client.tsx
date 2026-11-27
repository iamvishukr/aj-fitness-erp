"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({
  children,
  className = "btn-primary w-full",
  pendingText = "Saving…",
  pending: pendingProp,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
  pending?: boolean;
}) {
  const status = useFormStatus();
  const pending = pendingProp ?? status.pending;
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : children}
    </button>
  );
}

/** A form whose submit asks for confirmation first (for deletes). */
export function ConfirmForm({
  action,
  message,
  children,
  className,
}: {
  action: () => Promise<void>;
  message: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <form
      action={action}
      className={className}
      onSubmit={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </form>
  );
}
