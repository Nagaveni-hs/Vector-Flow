# Vector Flow — Full test checklist (Sprint 6)

This checklist is for local testing first, and for production testing
after deployment, when the site owner gives a separate go for deploy.
Nothing in this file claims that a production test passed, because
this site is not deployed yet. Tick a line only after that exact
test passes on the build you are testing.

## Quick local checks (can run now)

Run the local server first, then in a second terminal run:

```
node scripts/local-checks.js
```

Or open the Local checks page as an admin at `/admin/checks`.
Both only check routes that need no secret. They do not check mail.

- Public events list loads.
- Gallery list loads.
- Team list loads.
- Sign-in check returns 200 when signed in, 401 when signed out.
- Admin list returns 401 or 403 for a normal student, 200 for an admin.
- Cron queue route without the cron secret header returns 403.
- Cron reminders route without the cron secret header returns 403.

## Manual checks (do these by hand, in order)

- A normal Gmail account is blocked at sign-in, with a clear message.
  A college `@vvce.ac.in` account signs in.
- Free event: register, no payment step, registration shows on Participation.
- Paid event: QR and receiver are shown, screenshot uploads, admin
  verifies it against that event's receiver and amount, verified mail
  goes to that student only. A rejected screenshot can be re-uploaded
  from Participation, and goes back to Pending review.
- Two paid events show two different receivers and QRs. A payment to
  the first event does not verify the second.
- The same student cannot register twice for the same event.
- Registration after closing time is blocked by the server, not just
  by hiding a button.
- Announcement mail reaches the students group, and a test student
  receives it. Editing the event afterwards does not send it again.
- Reminder goes only to registered students, once, about 24 hours
  before the event, and only when the reminder route is called with
  the correct cron secret.
- Admin dashboard: search by name, USN, and email finds the right
  student. Payment filter and attendance filter work. CSV download
  contains the same filtered list.
- Attendance: a cancelled registration cannot be marked Present,
  on the page and on the server. Save all shows Present, Absent,
  and unmarked counts before saving.
- Certificates: an Absent student cannot get a certificate, even if
  a file is uploaded by mistake, because upload requires Present.
  An uploaded certificate shows no download on Participation.
  A held certificate gets no mail and is not shown to the student.
  A ticked certificate is queued, not sent at once. After the queue
  runs, in batches of 20, the student gets a mail with the PDF and
  a Download button on Participation. One failed mail does not block
  the rest of the batch, and Retry queues that one student again.
- Team publish: a new year is prepared as a draft, previewed, then
  published. The new year becomes live, the old year is still visible
  under History, and the draft never changed the live page before Publish.
- Gallery: upcoming events and history are separate, and each card
  with a drive link opens that link. A card without a drive link
  says so plainly, instead of showing a broken link.
- PWA: the site installs from the browser on Android Chrome and on
  iPhone Safari, with the Vector Flow placeholder icon. The offline
  page loads when the device is offline. The icon is a placeholder,
  not the real club logo, and must be replaced before launch if the
  club has a real logo.
- Mobile: every new page in Sprints 3 to 5 looks right on a phone,
  tables scroll sideways instead of breaking the page, and empty
  states read "No upcoming events yet" and "No certificates yet"
  where they apply.

## Real test event, end to end (do this with real students, once)

Do not use real production data for this. Use a test event, with
test students, and remove the test data afterwards (see below).

1. Publish a test event.
2. Announce it to the group, and confirm a test student receives it.
3. Register for it as a free student and as a paid student.
4. Run the reminder route for an event starting in 24 to 25 hours,
   and confirm only registered students get it, once.
5. Mark attendance, including one Present and one Absent student.
6. Upload a certificate for the Present student only, tick it, send
   it, run the queue, and confirm the student gets the mail and the
   download. Confirm the Absent student gets nothing.
7. Publish a test team year, and confirm the old year is in History.
8. Fix every break found here before announcing the site to the
   whole college.

## Before the first real event: remove test data

The site has no delete button for events in this version. To remove
test data, do one of these, with a backup first, and only before the
first real event:

- Set each test event to Cancelled, and ignore it in the admin list.
  This keeps the rows in the database, but hides them from students.
- Or, ask the site owner to remove the test rows directly from the
  database, in this order: certificates, then registrations, then
  mail logs for the test event, then the test event itself.
  Never delete real student data. Only remove test data, and only
  before the first real event. If you are not sure whether a row is
  test data or real data, leave it alone and ask the site owner.
