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

This guide is for the team: Nagendra, Nageveni, Jithin. Simple English.
Follow the steps in order. Do not skip a step.

## What you need before you start

- A Windows laptop.
- VS Code installed.
- Node.js installed (the LTS version, from nodejs.org).
- Git installed.
- A GitHub account.
- Access to the club repo. If you cannot see it, tell Nagendra.

Check Node and Git are installed. Open PowerShell and run:

```
node --version
```

```
git --version
```

Both must print a version number. If one says "not recognized", install
it first and close and open PowerShell again.

## First-time setup (do this only once)

### Step 1 — Fork the club repo

1. Open `https://github.com/vectorflow-club/Vector-Flow` in your browser.
2. Click **Fork** (top right).
3. Fork it to your own GitHub account.
4. Do not change anything in the fork settings.

### Step 2 — Clone your fork to your laptop

1. Open PowerShell.
2. Go to the folder where you keep projects. Example:

```
cd P:\VectorFlow
```

3. Clone your fork. Replace `YOUR-GITHUB-USERNAME` with your own username:

```
git clone https://github.com/YOUR-GITHUB-USERNAME/Vector-Flow.git Website
```

4. Go into the folder:

```
cd Website
```

### Step 3 — Add the club repo as `origin`

Your fork is now called `origin`. We need the club repo as `origin`
instead, and your fork as `personal`. Run these two commands, one at
a time:

```
git remote set-url origin https://github.com/vectorflow-club/Vector-Flow.git
```

```
git remote add personal https://github.com/YOUR-GITHUB-USERNAME/Vector-Flow.git
```

Check it with:

```
git remote -v
```

You must see `origin` pointing to `vectorflow-club/Vector-Flow` and
`personal` pointing to your own fork. If it is wrong, stop and tell
Nagendra. Do not run `git remote add personal` again if it already
exists.

### Step 4 — Put the `.env` file in the project folder

1. Nagendra will share the actual `.env` file with you.
2. Save it in the `Website` folder, with the exact name `.env`.
3. Never commit it. Never share it outside the team. Never paste its
   contents in chat.
4. Check it is hidden from Git:

```
git status
```

`.env` must NOT appear in the list. If it appears, stop and tell
Nagendra.

### Step 5 — Install the packages

In the `Website` folder, run:

```
npm install
```

Wait until it finishes. It can take a few minutes the first time.

### Step 6 — Set up the database connection

Run:

```
npx prisma generate
```

Wait until it finishes. You must run this again after any database
change (see "Common problems" below).

### Step 7 — Start the website

Run:

```
npm run dev
```

Wait until it says `Ready`. Then open your browser and go to:

```
http://localhost:3000
```

You must see the Vector Flow homepage.

### Step 8 — Sign in and get admin access

1. On the website, click **Sign in**.
2. Sign in with your college email (`@vvce.ac.in`).
3. The first time you sign in, your account is a normal student
   account. You are not an admin yet.
4. Tell Nagendra you signed in. He will make you an admin in the
   database.
5. After that, sign out and sign in again. You must now see the
   **Admin** link at the top.

If sign-in shows "NOT_COLLEGE_EMAIL", you used the wrong Google
account. Sign in with your college email only.

## Before working (do this EVERY time you start work)

Do these steps every time, before you change any code. Skipping them
is how old code gets merged by mistake.

### Step 1 — Sync your fork on GitHub

1. Open your fork on GitHub:
   `https://github.com/YOUR-GITHUB-USERNAME/Vector-Flow`.
2. Click **Sync fork**, then **Update branch**.
3. If it offers **Discard commits**, do NOT click it. Discard deletes
   your work. Stop and tell Nagendra.

### Step 2 — Pull the latest code to your laptop

In PowerShell, in the `Website` folder:

```
git fetch origin
```

```
git checkout main
```

```
git pull origin main
```

Your `main` must now match the club main. Check it with:

```
git log --oneline -3
```

The top commit must be the latest club main commit. If you are not
sure, tell Nagendra before you start.

### Step 3 — Make a new branch for your work

Never work on `main`. Never reuse a branch that was already merged.
Make a new branch every time:

```
git checkout -b your-work-name
```

Use a short name for your work, for example `fix-mobile-menu` or
`team-page-update`. Use only small letters, numbers, and dashes.

### Step 4 — Start the dev server

```
npm run dev
```

Keep this terminal open. It must say `Ready`.

## While you work

- Work only on your branch.
- Change only what your task needs. Do not touch other files.
- If `package.json` changed (someone added a package), run
  `npm install` again.
- If the database changed (someone changed `prisma/schema.prisma`),
  run `npx prisma generate` again, before you test.
- Test your change in the browser at `http://localhost:3000`.
- Test on mobile size too: make the browser window narrow, like a phone.
- Never commit the `.env` file.
- `package-lock.json` is tracked in the repo. Commit it when it
  changes, so everyone installs the same versions.
- Never push directly to the club repo main branch.
- Never merge your own pull request without checking it first.

## After working (do this EVERY time you finish work)

### Step 1 — Check what you changed

```
git status
```

Look at the list. It must show only the files you meant to change.
It must NOT show `.env` or any `.patch` file.

### Step 2 — Run the checks script (`node scripts/local-checks.js`)

The dev server must be running in a separate terminal first. Then, in
a new terminal, in the `Website` folder:

```
node scripts/local-checks.js
```

All checks must pass. If one fails, fix it before you commit. Do not
commit with a failing check.

### Step 3 — Run the build

```
npm run build
```

The build must pass. If it fails, fix it before you commit.

### Step 4 — Commit your work

```
git add -A
```

```
git status
```

Check the list again. Only your files. Then commit:

```
git commit -m "Short message about what you changed"
```

Write a short, clear message. Example:
`git commit -m "Fix mobile menu not closing after tap"`.

### Step 5 — Push your branch to your fork

```
git push personal your-work-name
```

Use your real branch name, not `your-work-name`.

### Step 6 — Pull request: your branch to your fork main

1. Open your fork on GitHub.
2. Click **Pull requests**, then **New pull request**.
3. Base: your fork, base branch: **main**.
4. Head: your fork, compare branch: **your-work-name**.
5. Click **Create pull request**.
6. Check the **Files changed** tab. It must show only your files.
7. Click **Merge pull request**, then **Confirm merge**.

### Step 7 — Pull request: your fork main to club main

1. Open your fork on GitHub.
2. Click **Pull requests**, then **New pull request**.
3. Base: **vectorflow-club/Vector-Flow**, base branch: **main**.
4. Head: your fork, compare branch: **main**.
5. Click **Create pull request**.
6. Check the **Files changed** tab. It must show only your change.
   If GitHub says there are conflicts, do NOT merge. Stop and tell
   Nagendra.
7. Merge it as a manager, from the club account.
8. Do not push directly to club main. Always go through a pull
   request.

### Step 8 — Tell the team

After the merge, tell the group: what you merged, and that everyone
must sync their fork before their next work. Then delete your branch,
or leave it, but never reuse it for new work.

## Run it locally

```
npm install
npx prisma generate
npm run dev
```

Open http://localhost:3000

If you change the database schema, run `npx prisma generate` again
before you build or typecheck. If your database does not have the
new fields yet, run `npx prisma db push` as well. If you are not sure,
ask the site owner before you push database changes.

## Environment variables, names only

Secrets live only in a local `.env` file, never in this repo, never
in chat, and never in a screenshot. The names the site reads are:

- DATABASE_URL, DIRECT_URL
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
- JWT_SECRET, CRON_SECRET
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
- APP_URL
- MAIL_FROM, STUDENTS_GROUP_EMAIL
- GMAIL_REFRESH_TOKEN (mail goes through the Gmail API now; the old
  SMTP password route is only a fallback, and SMTP is blocked for the
  club mailbox, so do not rely on it)
- SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS (fallback only, see above)

If mail does not work, check those names first. While mail is down,
registrations, payments, attendance, and certificates still work on
the site, and mails are recorded as failed or queued until mail works
again.

## Pages for admins

- Admin dashboard: `/admin`
- Attendance for an event: `/admin/events/[id]/attendance`
- Certificates for an event: `/admin/events/[id]/certificates`
- Team admin: `/admin/team`
- Mail: `/admin/mail`

## Testing and launch

Full checklist: `TEST-CHECKLIST.md` in this repo root, plus
`node scripts/local-checks.js` after `npm run dev` is up. Those checks run locally only. They do not
prove anything about a live production site.

The site is live on Vercel, deployed from club main. The Vercel
project lives under the vectorflow-club team, and the production
domain is https://vector-flow-club.vercel.app (the original address,
https://vector-flow-neon.vercel.app, still works too). Every merge to
club main auto-deploys to production — there is no manual deploy
step. Never press Redeploy on an old deployment, because that
rebuilds the old code instead of the merged one.

To verify a deploy: open the Vercel project, check the Deployments
tab for the deployment matching the merged commit, wait for its
status to read Ready, then open the production URL and check the
change is live there. Local checks passing proves nothing about
production; only the Ready deployment on the production URL does.

## PWA icon note

The icons in `public/icons/` are simple placeholders, dark blue
squares with the letters VF. They are not the real club logo.
Replace them with the real club logo, in 192 and 512 sizes, plus a
maskable 512 size, before launch, if the club has a real logo.

## Common problems and fixes

### "Could not reach the server" when running `scripts/local-checks.js`

The dev server is not running. Open a terminal, run `npm run dev`,
wait for `Ready`, then run the checks in a second terminal.

### A page looks broken or unstyled after a merge

The dev server is stale. Stop it with Ctrl+C, then run:

```
Remove-Item -Recurse -Force .next
```

```
npm run dev
```

Then hard refresh the browser with Ctrl+Shift+R.

### A page says "Loading..." forever

First, check you are signed in. Then close the tab, open a fresh
tab, and open the page again. If it still says "Loading...", stop
the dev server, start it again, and try once more. If it still does
not load, tell Nagendra and send a screenshot.

### `git pull` says "Already up to date" but GitHub shows you are behind

You pulled from your own fork, not from the club repo. Use
`git pull origin main`, not `git pull`. `origin` is the club repo.

### Port 3000 is already in use

Another dev server is already running. Close the other terminal, or
find it and press Ctrl+C in it, then run `npm run dev` again.

### Type errors about database fields after a change

You changed the database but did not regenerate the client. Run:

```
npx prisma generate
```

Then run the build again.

### Sign-in shows "NOT_COLLEGE_EMAIL"

You signed in with a personal Gmail. Sign out, and sign in with
your college email (`@vvce.ac.in`) only.

### You see a "Discard commits" button on GitHub

Do NOT click it. It deletes work. Stop and tell Nagendra.

## Rules for everyone

1. Sync your fork before every work session.
2. Work on a new branch, never on `main`.
3. Never push directly to club main.
4. Never merge a pull request without checking the Files changed list.
5. Never commit `.env`.
6. Never share the `.env` file outside the team.
7. Tell the group after every merge, so everyone syncs.
8. If you are stuck for more than 30 minutes, ask in the group. Do
   not guess and do not force a merge.

## Quick reference

| What | Command / Address |
|---|---|
| Start the website | `npm run dev` |
| Open the website | `http://localhost:3000` |
| Install packages | `npm install` |
| Update database client | `npx prisma generate` |
| Run the checks script | `node scripts/local-checks.js` |
| Build the website | `npm run build` |
| Check what changed | `git status` |
| Club repo | `https://github.com/vectorflow-club/Vector-Flow` |
| Your fork | `https://github.com/YOUR-GITHUB-USERNAME/Vector-Flow` |
