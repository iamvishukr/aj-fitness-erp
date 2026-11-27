import "server-only";
import bcrypt from "bcryptjs";

/**
 * Database layer.
 * - If DATABASE_URL is set → real PostgreSQL (Neon, Supabase, Railway, your own server).
 * - Otherwise → embedded PGlite (Postgres in WASM) stored in ./.data, zero setup for local use.
 * Both expose the same `query(sql, params)` → { rows } shape.
 */

type Row = Record<string, unknown>;
interface Driver {
  query<T extends Row = Row>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
  /** Runs setup on a single connection holding a Postgres advisory lock (safe when several servers start at once). */
  locked<R>(fn: (d: Driver) => Promise<R>): Promise<R>;
}

const g = globalThis as unknown as { __gymDb?: Promise<Driver> };

async function createDriver(): Promise<Driver> {
  // Vercel's Neon / Postgres integrations may expose the URL under either name
  const url = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  if (!url && process.env.VERCEL) {
    throw new Error(
      "No database configured. In Vercel → Project → Storage, connect a Postgres (Neon) database, then redeploy.",
    );
  }
  if (url) {
    const pg = await import("pg");
    // Keep DATE columns as 'YYYY-MM-DD' strings (no timezone shifting)
    pg.types.setTypeParser(1082, (v: string) => v);
    pg.types.setTypeParser(20, (v: string) => Number(v)); // bigint → number
    // Hosted Postgres (Neon, Supabase…) uses publicly trusted certificates, so verify them fully.
    const connectionString = url.replace(/sslmode=(require|prefer|verify-ca)/, "sslmode=verify-full");
    const pool = new pg.Pool({ connectionString, max: 5 });
    const wrap = (c: { query: (sql: string, p?: unknown[]) => Promise<{ rows: unknown[] }> }): Omit<Driver, "locked"> => ({
      query: async <T extends Row>(sql: string, params?: unknown[]) => ({ rows: (await c.query(sql, params)).rows as T[] }),
      exec: (sql: string) => c.query(sql),
    });
    const base = wrap(pool as never);
    const drv: Driver = {
      ...base,
      locked: async (fn) => {
        const client = await pool.connect();
        try {
          await client.query("SELECT pg_advisory_lock(472918)");
          const inner = wrap(client as never);
          return await fn({ ...inner, locked: (f) => f(drv) });
        } finally {
          await client.query("SELECT pg_advisory_unlock(472918)").catch(() => {});
          client.release();
        }
      },
    };
    return drv;
  }
  const { PGlite, types } = await import("@electric-sql/pglite");
  const dir = process.env.PGLITE_DIR || "./.data/gym";
  const { mkdirSync } = await import("fs");
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir, {
    parsers: {
      [types.DATE]: (v: string) => v,
      [types.INT8]: (v: string) => Number(v),
    },
  });
  await db.waitReady;
  const drv: Driver = {
    query: async <T extends Row>(sql: string, params?: unknown[]) => {
      const r = await db.query<T>(sql, params as unknown[]);
      return { rows: r.rows };
    },
    exec: (sql: string) => db.exec(sql),
    locked: (fn) => fn(drv),
  };
  return drv;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  token_version INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS plans (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  duration_days INT NOT NULL,
  price INT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS members (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  gender TEXT,
  dob DATE,
  address TEXT,
  emergency_contact TEXT,
  height_cm INT,
  weight_kg NUMERIC(5,1),
  health_notes TEXT,
  notes TEXT,
  joined_on DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS members_phone_idx ON members(phone);
CREATE TABLE IF NOT EXISTS memberships (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  plan_id INT REFERENCES plans(id) ON DELETE SET NULL,
  plan_name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  fee INT NOT NULL,
  discount INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS memberships_member_idx ON memberships(member_id, end_date);
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  membership_id INT REFERENCES memberships(id) ON DELETE SET NULL,
  amount INT NOT NULL,
  method TEXT NOT NULL DEFAULT 'cash',
  paid_on DATE NOT NULL,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS payments_paid_on_idx ON payments(paid_on);
CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  member_id INT NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  day DATE NOT NULL,
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(member_id, day)
);
ALTER TABLE members ADD COLUMN IF NOT EXISTS is_demo BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS extra_days INT NOT NULL DEFAULT 0;
ALTER TABLE memberships ADD COLUMN IF NOT EXISTS extra_note TEXT;
`;

async function init(): Promise<Driver> {
  const drv = await createDriver();
  await drv.locked((d) => setup(d));
  return drv;
}

async function setup(d: Driver) {
  await d.exec(SCHEMA);

  // First run: create the admin account from env (or a default to change immediately)
  const { rows } = await d.query<{ n: number }>("SELECT count(*)::int AS n FROM admins");
  if (rows[0].n === 0) {
    const email = (process.env.ADMIN_EMAIL || "admin@ajfitness.local").toLowerCase();
    const password = process.env.ADMIN_PASSWORD || "admin123";
    if (!process.env.ADMIN_PASSWORD) {
      await d.query("INSERT INTO settings (key, value) VALUES ('default_password','1') ON CONFLICT (key) DO NOTHING");
    }
    const hash = await bcrypt.hash(password, 10);
    await d.query("INSERT INTO admins (name, email, password_hash) VALUES ($1,$2,$3) ON CONFLICT (email) DO NOTHING", [
      process.env.ADMIN_NAME || "Admin",
      email,
      hash,
    ]);
  }
  const plans = await d.query<{ n: number }>("SELECT count(*)::int AS n FROM plans");
  if (plans.rows[0].n === 0) {
    await d.query(
      `INSERT INTO plans (name, duration_days, price) VALUES
       ('Monthly', 30, 1000), ('Quarterly', 90, 2700), ('Half-Yearly', 180, 5000), ('Yearly', 365, 9000)`,
    );
  }
  await d.query(
    `INSERT INTO settings (key, value) VALUES ('gym_name', $1) ON CONFLICT (key) DO NOTHING`,
    [process.env.GYM_NAME || "AJ Fitness"],
  );
}

function driver(): Promise<Driver> {
  if (!g.__gymDb) {
    g.__gymDb = init().catch((e) => {
      g.__gymDb = undefined;
      throw e;
    });
  }
  return g.__gymDb;
}

export async function query<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T[]> {
  const d = await driver();
  const r = await d.query<T>(sql, params);
  return r.rows;
}

export async function one<T extends Row = Row>(sql: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] ?? null;
}
