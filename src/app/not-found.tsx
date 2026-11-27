import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-dvh grid place-items-center px-6">
      <div className="text-center">
        <div className="text-5xl font-black text-accent-soft">404</div>
        <p className="text-muted mt-2">This page or member doesn&apos;t exist.</p>
        <Link href="/" className="btn-primary mt-6">
          Go to dashboard
        </Link>
      </div>
    </main>
  );
}
