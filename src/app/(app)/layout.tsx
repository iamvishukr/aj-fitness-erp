import { requireAdmin } from "@/lib/auth";
import { BottomNav } from "@/components/bottom-nav";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <main className="mx-auto max-w-xl px-4 pt-[max(env(safe-area-inset-top),1rem)] pb-28">{children}</main>
      <BottomNav />
    </>
  );
}
