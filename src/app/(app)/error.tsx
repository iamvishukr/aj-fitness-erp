"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card p-6 text-center mt-10">
      <div className="text-lg font-bold">Something went wrong</div>
      <p className="text-sm text-muted mt-1">Please check your internet connection and try again.</p>
      <button onClick={reset} className="btn-primary mt-5 w-full">
        Try again
      </button>
    </div>
  );
}
