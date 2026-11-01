# Vector Flow — VVCE

Official website of Vector Flow, the CSE (AI & ML) club at VVCE Mysore.

Students sign in with a college `@vvce.ac.in` account, see current
activities and posters, register for events, and later find their
participation history and certificates. Admins post events, check
registrations and payments, mark attendance, and send certificates.

## Stack

- Frontend: React + Vite, deployed on Vercel
- Backend: Vercel Serverless Functions (Node) under `api/`
- Database: PostgreSQL on Neon, via Prisma
- Auth: Google sign-in, restricted to `@vvce.ac.in` on the server
- Mail: SMTP from `vectorflow@vvce.ac.in`
- Install: PWA from the browser, no Play Store or App Store

There is **no payment gateway, now or later**. Payment is manual UPI:
each paid event has its own receiver (name, contact and QR image), and
an admin verifies payment screenshots against that event's receiver
and amount.

## Run locally

```bash
npm install
cp .env.example .env
# Fill in .env locally. Never commit a real .env file.
npx prisma migrate dev
npx prisma generate
npm run dev
```

After every change to `prisma/schema.prisma`, run in this order:

```bash
npx prisma migrate dev --name <short-change-name>
npx prisma generate
```

## Deploy

1. Import this repo in Vercel.
2. Set the environment variables from `.env.example` in Vercel Project Settings.
   Use the Neon **pooled** connection string for `DATABASE_URL` and the
   **direct** string for `DIRECT_URL`.
3. Deploy. The frontend and the `api/` functions deploy together.

## Sprint plan

See the implementation plan shared with the team. In short:

- Sprint 0: setup and proof (this commit) — structure, schema, deployment
- Sprint 1: auth, events, registration
- Sprint 2: mail and 24-hour reminder
- Sprint 3: admin dashboard, payment check, attendance
- Sprint 4: certificates (queued, in batches)
- Sprint 5: Gallery, Team page, PWA
- Sprint 6: launch, handover, documentation

## Team page yearly update

Publishing a new team year automatically moves the previous current team
into History. Nothing is deleted, and preparing a new year never edits
the live current team until Publish.
