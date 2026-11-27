import { timingSafeEqual } from "crypto";
import { runReminders } from "@/lib/reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Called once a day by Vercel Cron (see vercel.json). Vercel sends "Authorization: Bearer <CRON_SECRET>".
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  const got = req.headers.get("authorization") ?? "";
  const want = `Bearer ${secret}`;
  const ok =
    !!secret && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
  if (!ok) return new Response("Unauthorized", { status: 401 });
  const summary = await runReminders();
  console.log("[reminders]", JSON.stringify(summary));
  return Response.json(summary);
}
