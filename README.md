# Vector Flow

Official website of Vector Flow, the CSE (AI & ML) club at VVCE Mysore.

## What this site does

Sign in with a college `@vvce.ac.in` account only, see events, register
for free and paid events, and see your participation and certificates.
Admins can post events, announce them, verify payments, mark
attendance, upload and send certificates, and publish a new team year.
There is no payment gateway, ever. Payments are manual UPI per event,
and an admin verifies the screenshot against that event's receiver
and amount.

## Run it locally

```
npm install
npx prisma generate
npm run dev
```

Open http://localhost:3000

If you change the database schema, run `npx prisma generate` again
before you build or typecheck. If your database does not have the
new fields yet, run `npx prisma db push` as well. This patch, Sprints
3 to 6, does not change the database schema, so no database push is
needed for it, as long as your database already has the Sprint 1
schema. If you are not sure, ask the site owner before you push
database changes.

## Environment variables, names only

Secrets live only in a local `.env` file, never in this repo, never
in chat, and never in a screenshot. The names the site reads are:

- DATABASE_URL, DIRECT_URL
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- JWT_SECRET, CRON_SECRET
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- APP_URL
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS
- MAIL_FROM, STUDENTS_GROUP_EMAIL

If mail does not work, check those names first, and check that the
mail password is a real mail password for the club mailbox, not a
placeholder. While mail is down, registrations, payments, attendance,
and certificates still work on the site, and mails are recorded as
failed or queued until mail works again.

## Fork, branches, and pull requests to the club

The club repo is the manager and upstream. Work never goes straight
to club main. The usual flow is:

1. Fork the club repo to your own GitHub account, if you have not
   already. Your fork is linked to the club repo.
2. Keep your fork main clean, as a mirror of club main. Sync it
   before you start new work.
3. Make a new branch for each task, for example `Nags` for the
   working branch, or a branch named after the task. Work in that
   branch, never in main.
4. Push that branch to your fork, not to the club repo.
5. Open a pull request from your fork branch to your fork main,
   merge it, then open a pull request from your fork main to club
   main. Or, open a pull request straight from your fork branch to
   club main. Either way, the club account must accept the pull
   request before club main changes. Pushing to your fork alone
   does not change club main.
6. After club accepts, delete the work branch, and sync your fork
   main again before the next task.

Teammates do the same, each from their own fork. No one pushes
directly to club main.

## Pages for admins

- Admin dashboard: `/admin`
- Attendance for an event: `/admin/events/[id]/attendance`
- Certificates for an event: `/admin/events/[id]/certificates`
- Team admin: `/admin/team`
- Admin handover note: `/admin/handover`
- Local checks: `/admin/checks`

## Testing and launch

Full checklist: `TEST-CHECKLIST.md` in this repo root, plus the
local checks page above and `node scripts/local-checks.js` after
`npm run dev` is up. Those checks run locally only. They do not
prove anything about a live production site, because this site is
not deployed yet.

Deployment to Vercel is deferred until the website is complete,
and needs a separate go from the site owner. Do not create a
Vercel project or deploy from this patch alone.

## PWA icon note

The icons in `public/icons/` are simple placeholders, dark blue
squares with the letters VF. They are not the real club logo.
Replace them with the real club logo, in 192 and 512 sizes, plus a
maskable 512 size, before launch, if the club has a real logo.
