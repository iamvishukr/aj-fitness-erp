import { redirect } from "next/navigation";
import { getAdmin } from "@/lib/auth";
import { getGymInfo } from "@/lib/data";
import { Wordmark } from "@/components/wordmark";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (await getAdmin()) redirect("/");
  const gym = await getGymInfo();
  return (
    <main className="min-h-dvh flex flex-col justify-center px-6 py-10 mx-auto max-w-sm">
      <div className="mb-10">
        <Wordmark size={40} />
        {(gym.address || gym.phone) && (
          <p className="text-[13px] text-muted mt-4 leading-relaxed">
            {gym.address}
            {gym.address && gym.phone && <br />}
            {gym.phone && <span className="tnum">📞 {gym.phone}</span>}
          </p>
        )}
        <p className="text-ink font-semibold mt-6">Admin sign in</p>
      </div>
      <LoginForm />
    </main>
  );
}
