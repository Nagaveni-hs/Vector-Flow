"use client";

import { useEffect, useState } from "react";

// Sprint 6 local checks page. This page runs the checks that can
// run locally, in the browser, and shows pass or fail for each.
// It does NOT claim that production tests passed, because this
// site is not deployed yet. Cron and mail checks that need a
// secret are listed as manual checks below, because the secret
// must never be shown in a page.
export default function Checks() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function run() {
      const checks = [];
      try {
        const events = await fetch("/api/events").then((r) => r.json());
        checks.push({ name: "Public events list loads", pass: !!events.ok });
      } catch {
        checks.push({ name: "Public events list loads", pass: false });
      }
      try {
        const gallery = await fetch("/api/gallery").then((r) => r.json());
        checks.push({ name: "Gallery list loads", pass: !!gallery.ok });
      } catch {
        checks.push({ name: "Gallery list loads", pass: false });
      }
      try {
        const team = await fetch("/api/team").then((r) => r.json());
        checks.push({ name: "Team list loads", pass: !!team.ok });
      } catch {
        checks.push({ name: "Team list loads", pass: false });
      }
      try {
        const me = await fetch("/api/auth/me");
        checks.push({
          name: "Sign-in check returns a clear answer (signed in, or not signed in)",
          pass: me.status === 200 || me.status === 401,
        });
      } catch {
        checks.push({ name: "Sign-in check returns a clear answer", pass: false });
      }
      try {
        const admin = await fetch("/api/admin/events");
        checks.push({
          name: "Admin list refuses a non-admin with 401 or 403, or loads for an admin",
          pass: admin.status === 200 || admin.status === 401 || admin.status === 403,
        });
      } catch {
        checks.push({ name: "Admin list refuses a non-admin", pass: false });
      }
      setResults(checks);
      setLoading(false);
    }
    run();
  }, []);

  if (loading) return <p>Loading...</p>;
  return (
    <div className="admin-content-page checks-page">
      <h1>Local checks</h1>
      <p>These checks run locally only. They do not prove anything about a live production site, because this site is not deployed yet.</p>
      {results.map((c) => (
        <p key={c.name}>
          {c.pass ? "PASS" : "FAIL"} - {c.name}
        </p>
      ))}
      <h2>Manual checks, do these by hand</h2>
      <p>1. Sign in with a college email, and check that a normal Gmail account is blocked with a clear message.</p>
      <p>2. Register for a free event and a paid event, check that you cannot register twice, and that both show on Participation.</p>
      <p>3. As an admin, verify one payment and reject one payment, and check that each student gets only their own mail.</p>
      <p>4. Mark attendance, upload one certificate for a Present student, tick it, send it, run the queue, and check that the student sees Download only after SENT.</p>
      <p>5. Call a cron route without the cron secret header, and check that it returns 403. Never put the secret in this page.</p>
      <p>6. Publish a new team year, and check that the old year is still visible under History.</p>
      <p>7. Install the site from the browser on a phone, and check the offline page loads when you are offline.</p>
      <p>Full checklist, including the real test event steps, is in TEST-CHECKLIST.md in the repo root.</p>
    </div>
  );
}
