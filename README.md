# AJ Fitness — Admin App

A phone-first admin app for AJ Fitness: admissions, membership expiry, renewals, dues, payments and attendance, with WhatsApp reminders in one tap.

Built with Next.js 16 (App Router, server actions), PostgreSQL and Tailwind CSS v4.

## Features
- **Secure login**: bcrypt passwords, signed httpOnly session cookie (30 days), login throttling, "sign out of all devices", password change.
- **Dashboard**: active / expiring / expired counts, total pending dues, monthly collection with a 6-month chart, an expiry timeline (yesterday, today, tomorrow, next 7 days, lapsed in the last 30 days), today's check-ins, today's birthdays and recent admissions.
- **Members**: search by name or phone; filter by Active, Expiring, Expired, Dues or No plan.
- **New admission**: member details (health notes, height and weight, emergency contact), plan, start date, discount, and amount paid now. The end date and the balance due are calculated for you. Duplicate phone numbers are flagged.
- **Member profile**: call, WhatsApp reminder, renew (the new plan starts the day after the current one ends), record payment (cash/UPI/card/bank), a payment receipt you can send on WhatsApp, a 14-day attendance strip, one-tap check-in, and full membership and payment history.
- **Freeze / extend**: add days to a membership (travel, illness, gym closed), with the reason shown in its history.
- **Check-in warning**: shown when a member's plan has expired.
- **Automatic WhatsApp reminders**: every morning (10–11 am IST), members get a WhatsApp message before expiry, after expiry and while dues are pending. Sent through WhatsApp's official Cloud API with approved templates. Setup steps are in the app under **More → WhatsApp reminders**. There's one message per member per day at most, a per-member opt-out and a full history.
- **Payments**: month by month, with a split by payment mode.
- **Plans**: add, edit or hide plans (Monthly, Quarterly, etc.).
- **Export**: download the member list as a CSV for Excel or Google Sheets.
- **Installable**: on your phone, use "Add to Home Screen" and it opens like an app.

## Run locally (no database setup needed)
```bash
npm install
npm run build && npm start      # or: npm run dev
```
Open http://localhost:3000 and sign in with **admin@ajfitness.local / admin123**. A red banner will remind you to change the password under **More** until you do.
On the empty dashboard, tap **"load demo members to explore"**. When you're done, remove the demo members under **More → Remove demo data**.

With no `DATABASE_URL` set, data is stored in `./.data` (an embedded Postgres).

## Use it from your phone on the gym Wi-Fi
Run `npm run build && npm start` on the gym computer, then open `http://<that-computer's-IP>:3000` on your phone (e.g. `http://192.168.1.5:3000`). Login works over plain http on the local network. Once it's online with https, the login cookie is automatically marked secure.

## Deploy (e.g. Vercel + Neon, both have free tiers)
1. Create a Postgres database at neon.tech and copy its connection string.
2. Push this folder to GitHub and import it in Vercel.
3. Add these environment variables (see `.env.example`): `DATABASE_URL`, `AUTH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`.
4. Deploy. The tables and the first admin account are created automatically the first time the app runs.

> Serverless hosts like Vercel have no persistent disk, so you **must** set `DATABASE_URL` there. On a VPS (`npm start` with pm2), the local `.data` database also works. Back up that folder.

## Project layout
```
src/proxy.ts                 redirects to /login when there is no session cookie
src/lib/auth.ts              sessions, requireAdmin(), throttling
src/lib/db.ts                Postgres / PGlite driver and schema (auto-migrates)
src/lib/data.ts              queries (member status, dues, revenue…)
src/lib/contact.ts           WhatsApp / call links and message templates
src/app/actions.ts           all server actions (validated with zod)
src/app/(app)/...            protected screens
src/app/login                sign-in screen
```
