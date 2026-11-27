import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { randomBytes } from "crypto";
import { cache } from "react";
import { one, query } from "./db";

export const SESSION_COOKIE = "gym_session";
const SESSION_DAYS = 30;

let secretPromise: Promise<Uint8Array> | null = null;

/** AUTH_SECRET from env; if missing, a random secret is generated once and kept in the database. */
function getSecret(): Promise<Uint8Array> {
  if (!secretPromise) {
    secretPromise = (async () => {
      let s = process.env.AUTH_SECRET;
      if (!s || s.length < 16) {
        const row = await one<{ value: string }>("SELECT value FROM settings WHERE key='auth_secret'");
        if (row) s = row.value;
        else {
          s = randomBytes(32).toString("hex");
          await query("INSERT INTO settings (key, value) VALUES ('auth_secret', $1) ON CONFLICT (key) DO NOTHING", [s]);
          s = (await one<{ value: string }>("SELECT value FROM settings WHERE key='auth_secret'"))!.value;
        }
      }
      return new TextEncoder().encode(s);
    })().catch((e) => {
      secretPromise = null;
      throw e;
    });
  }
  return secretPromise;
}

export async function createSession(adminId: number, tokenVersion: number) {
  const token = await new SignJWT({ sub: String(adminId), tv: tokenVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(await getSecret());
  // Secure only when the request actually came over HTTPS, so the app also works on http://<LAN-IP>:3000
  const h = await headers();
  const secure =
    process.env.COOKIE_SECURE === "true" ||
    (process.env.COOKIE_SECURE !== "false" && h.get("x-forwarded-proto")?.split(",")[0].trim() === "https");
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}

export type Admin = { id: number; name: string; email: string };

/** Returns the logged-in admin or null. Verifies signature, expiry and token version (for "log out everywhere"). */
export const getAdmin = cache(async (): Promise<Admin | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, await getSecret(), { algorithms: ["HS256"] });
    const admin = await one<Admin & { token_version: number }>(
      "SELECT id, name, email, token_version FROM admins WHERE id=$1",
      [Number(payload.sub)],
    );
    if (!admin || admin.token_version !== payload.tv) return null;
    return { id: admin.id, name: admin.name, email: admin.email };
  } catch {
    return null;
  }
});

/** Use at the top of every protected page / server action. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) redirect("/login");
  return admin;
}

// --- login throttle, stored in the database so it holds across all server instances ---
const MAX_ATTEMPTS = 5;
const LOCK_MINUTES = 15;

export async function isThrottled(key: string, max = MAX_ATTEMPTS): Promise<boolean> {
  const r = await one<{ count: number }>("SELECT count FROM login_attempts WHERE key=$1 AND until > now()", [key]);
  return !!r && r.count >= max;
}
export async function recordFailure(key: string) {
  await query(
    `INSERT INTO login_attempts (key, count, until) VALUES ($1, 1, now() + make_interval(mins => $2))
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN login_attempts.until < now() THEN 1 ELSE login_attempts.count + 1 END,
       until = CASE WHEN login_attempts.until < now() THEN EXCLUDED.until ELSE login_attempts.until END`,
    [key, LOCK_MINUTES],
  );
  await query("DELETE FROM login_attempts WHERE until < now() - interval '1 day'");
}
export async function clearFailures(key: string) {
  await query("DELETE FROM login_attempts WHERE key=$1", [key]);
}
