// Sprint 6 admin handover note, as a page in the site, so a future
// admin can read it without hunting for a separate document.
// This page is for admins only in practice, because only admins
// are linked to it, but the steps below are the same for any admin.

export default function Handover() {
  return (
    <div className="admin-content-page handover-page">
      <h1>Admin handover note</h1>
      <p>
        This note is for future Vector Flow admins. It covers the daily
        jobs on this website, in plain words. If you are new, read it
        once from top to bottom, then keep it open while you do your
        first event.
      </p>
      <h2>1. Post an event</h2>
      <p>
        Sign in as an admin, go to Admin, then Create a new event. Fill
        in the title, description, date and time, and venue. For a paid
        event, you must also fill in the amount, the payment receiver
        name, the receiver contact, and the payment QR image. For a
        free event, leave those blank. Set the status to Published
        only when the event is ready for students to see. Draft events
        are not shown on Home.
      </p>
      <h2>2. Announce an event</h2>
      <p>
        On the Edit event page, check the announcement preview first.
        It shows exactly who the mail goes to and what it says. Press
        Send announcement only once. The site blocks a second send for
        the same event. Editing the event afterwards does not send
        the announcement again.
      </p>
      <h2>3. Verify payments</h2>
      <p>
        Go to Admin, pick the event, and press Show registrations.
        For each paid registration that is Pending review, open the
        screenshot, and check it against that event's receiver name
        and amount. The site cannot check a screenshot automatically.
        If it matches, press Verify. If it does not match, write a
        clear reason in the reason box, then press Reject. The student
        gets a mail either way, and a rejected student can upload a
        new screenshot from the Participation page.
      </p>
      <h2>4. Mark attendance</h2>
      <p>
        Go to Admin, pick the event, then Attendance. Pick Present,
        Absent, or Unmarked for each student, then press Save all.
        Check the warning count before you save: it says how many
        Present, Absent, and unmarked you have. A cancelled
        registration can never be marked Present. Only students
        marked Present can get a certificate later.
      </p>
      <h2>5. Send certificates</h2>
      <p>
        Go to Admin, pick the event, then Certificates. Only Present
        students are listed. Upload a PDF for each student, tick the
        rows you want to send, check the preview line that says Send
        to X and hold Y, then press Send. Sending only queues the
        mails. The queue worker sends them in batches of 20. Refresh
        the page after the queue runs to see SENT or FAILED. For a
        failed certificate, press Retry. A held certificate gets no
        mail and is not shown to the student. A student only sees a
        download button on Participation after the certificate is SENT.
      </p>
      <h2>6. Publish a new team year</h2>
      <p>
        Go to Admin, then Team admin. Add members for the new year,
        or copy last year as a draft and edit it. Preview the draft
        first. When it is ready, press Publish this year. Publishing
        makes that year live, and the old live year becomes History.
        It is never deleted. Preparing a draft never changes the live
        team until you press Publish.
      </p>
      <h2>7. If mail stops working</h2>
      <p>
        First, check that the mail settings are still set in the
        server settings, by their names only: SMTP_HOST, SMTP_PORT,
        SMTP_USER, SMTP_PASS, MAIL_FROM, STUDENTS_GROUP_EMAIL, and
        CRON_SECRET. Never paste those values in chat or in a group.
        If the mail password was changed, update it in the server
        settings only, and restart the site. If the club mailbox is
        a college mailbox, the college admin may have turned off
        the setting that allows the mail password to be made. In
        that case, ask the college admin to allow it for the club
        mailbox, and do not try the same password over and over.
        While mail is down, registrations, payments, attendance,
        and certificates still work on the site. Mails will be
        recorded as failed, and certificates will stay queued until
        mail works again and the queue runs.
      </p>
      <h2>8. Before the first real event</h2>
      <p>
        Remove test events, test registrations, and test certificates
        before the first real event, or mark them clearly as tests.
        The site has no delete button for events in this version, so
        to remove test data, set a test event to Cancelled and ignore
        it, or ask the site owner to remove the test rows from the
        database directly, with a backup first. Never delete real
        student data. Only remove test data, and only before the
        first real event.
      </p>
    </div>
  );
}
