import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { getGymName } from "@/lib/data";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/");
  const gym = await getGymName();
  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-10 mx-auto max-w-sm">
      <div className="mb-10">
        <div className="size-14 rounded-2xl bg-accent grid place-items-center mb-6">
          <span className="text-[22px] font-black tracking-tight text-[#0b0d10]">AJ</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight">{gym}</h1>
        <p className="text-muted mt-1.5">Admin sign in</p>
      </div>
      <LoginForm />
    </main>
  );
}
