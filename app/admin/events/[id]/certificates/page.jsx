"use client";

import { useEffect, useState } from "react";
import CertificateUpload from "@/components/CertificateUpload";
import CertificateGenerator from "@/components/CertificateGenerator";
import Skeleton from "@/components/Skeleton";

// Sprint 4 certificates page. Only students marked Present are
// listed here. For each row the admin can upload a PDF, tick the
// row for sending, hold a certificate, or retry a failed one.
// The preview line says, in plain words, how many will be sent
// and how many will be held, based on the ticks on screen.
// Pressing Send does not send mail itself. It queues the ticked
// certificates, and the queue worker sends them in batches of 20.
// After sending, refresh this page to see the new status: QUEUED
// becomes SENT or FAILED after the queue runs. Held certificates
// get no mail and are not shown to the student.
// The certificate generator above the table is NOT gated on
// Present students: the template, name placement and font can be
// set up before attendance is marked, and they save to the event
// straight away. Only generating, and the table below it, need
// Present students — with none Present the generator shows where
// to mark attendance instead of the Generate button.
export default function Certificates({ params }) {
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [certificates, setCertificates] = useState([]);
  // m10 (minors, coordinator addition): the list API returns a total
  // alongside the first 100 rows, so the page can say when the list
  // is truncated instead of silently showing only the first 100.
  const [certTotal, setCertTotal] = useState(null);
  const [ticks, setTicks] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  // M10: one in-flight key per action, matching the busy-key pattern
  // on the admin dashboard page, so a double-click cannot queue or
  // save the same certificate twice.
  const [busyKey, setBusyKey] = useState(null);

  async function load() {
    setError("");
    try {
      const attRes = await fetch(`/api/admin/events/${params.id}/attendance`);
      const att = await attRes.json();
      if (!att.ok) {
        // m19: only a genuine 401/403 is an access error. A 404 is
        // a missing event; anything else is a load problem.
        if (attRes.status === 401 || attRes.status === 403) {
          setError("Certificates are for admins only. Please sign in as an admin.");
        } else if (attRes.status === 404) {
          setError("This event was not found.");
        } else {
          setError("Could not load the certificates. Check your connection and try again.");
        }
        return;
      }
      setEvent(att.data.event);
      setRegistrations(att.data.registrations.filter((r) => r.attendance === "PRESENT" && r.status === "REGISTERED"));
      const certRes = await fetch(`/api/admin/certificates?eventId=${params.id}`);
      const cert = await certRes.json();
      if (cert.ok) {
        setCertificates(cert.data.certificates);
        if (typeof cert.data.total === "number") setCertTotal(cert.data.total);
        const t = {};
        cert.data.certificates.forEach((c) => {
          if (c.status === "UPLOADED" || c.status === "FAILED") t[c.id] = false;
        });
        setTicks(t);
      } else {
        // m39: a failed certificate-list fetch used to leave the list
        // empty, and every row wrongly said "No certificate uploaded".
        setError("Could not load the certificates. Check your connection and try again.");
      }
    } catch {
      setError("Could not load the certificates. Check your connection and try again.");
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  function certFor(registrationId) {
    return certificates.find((c) => c.registrationId === registrationId) || null;
  }

  async function saveUpload(registrationId, fileUrl, fileName) {
    const key = `upload:${registrationId}`;
    // The upload button lives inside CertificateUpload, which is not
    // this page's file, so the in-flight guard lives here: a second
    // save for the same student while one is running is ignored.
    if (busyKey === key) return;
    setBusyKey(key);
    setMessage("");
    try {
      const res = await fetch("/api/admin/certificates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registrationId, fileUrl, fileName }),
      });
      const json = await res.json();
      if (!json.ok) {
        // M10: when the server refuses a re-upload, show its own
        // message first (for example that the certificate is already
        // queued, held, or sent). The refusal carries its message
        // at the top level of the response (the API builds it
        // directly, because fail() has no message field), so read
        // json.message first, then the error code, then generic.
        setMessage(
          json.message ||
            json.error ||
            "Could not save that certificate. Only Present students can get a certificate, and the file must be a PDF."
        );
        return;
      }
      setMessage("Certificate saved. It is held until you tick it and press Send.");
      load();
    } catch {
      setMessage("Could not save that certificate. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function sendTicked() {
    const ids = Object.keys(ticks).filter((id) => ticks[id]);
    if (ids.length === 0) {
      setMessage("Please tick at least one certificate before you press Send.");
      return;
    }
    if (busyKey === "send") return;
    setBusyKey("send");
    try {
      const res = await fetch("/api/admin/certificates/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ certificateIds: ids }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not queue those certificates. Please try again.");
        return;
      }
      setMessage(
        `Queued ${json.data.queued} certificates for sending. ${json.data.skipped} were skipped, because they were already sent or already queued. The queue sends in batches of 20. Refresh this page after the queue runs to see SENT or FAILED.`
      );
      setTicks({});
      load();
    } catch {
      setMessage("Could not queue those certificates. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function retry(id) {
    const key = `retry:${id}`;
    if (busyKey === key) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/certificates/${id}/retry`, { method: "POST" });
      const json = await res.json();
      setMessage(json.ok ? "That certificate is queued again." : "Could not retry that certificate.");
      load();
    } catch {
      setMessage("Could not retry that certificate.");
    } finally {
      setBusyKey(null);
    }
  }

  async function hold(id, action) {
    const key = `hold:${id}`;
    if (busyKey === key) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/certificates/${id}/hold`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      setMessage(json.ok ? (action === "HOLD" ? "Certificate held. No mail will be sent for it." : "Certificate is back to uploaded.") : "Could not change that certificate.");
      load();
    } catch {
      setMessage("Could not change that certificate.");
    } finally {
      setBusyKey(null);
    }
  }

  const tickedCount = Object.keys(ticks).filter((id) => ticks[id]).length;
  // M16: "hold" counts only UPLOADED/FAILED certificates that are
  // unticked. Already-SENT and already-QUEUED ones are not held --
  // they were counted as holds before, overstating the number.
  const heldCount = registrations.filter((r) => {
    const cert = certFor(r.id);
    return cert && (cert.status === "UPLOADED" || cert.status === "FAILED") && !ticks[cert.id];
  }).length;

  if (error)
    return (
      <div className="admin-content-page certificates-page">
        <h1>Certificates</h1>
        <p className="error">{error}</p>
        <p>
          <button onClick={load}>Try again</button>
        </p>
      </div>
    );
  if (!event) {
    return (
      <div className="admin-content-page certificates-page">
        <h1>Certificates</h1>
        <div aria-label="Loading certificates">
          <Skeleton variant="row" count={3} />
        </div>
      </div>
    );
  }
  return (
    <div className="admin-content-page certificates-page">
      <h1>Certificates for {event.title}</h1>
      <p>Only students marked Present are listed here.</p>
      <CertificateGenerator
        eventId={params.id}
        event={event}
        registrations={registrations}
        onSaved={load}
      />
      {registrations.length === 0 ? null : (
        <>
          <p>
            Preview: Send to {tickedCount}, hold {heldCount}. Held certificates get no mail and are not shown to the student.
          </p>
          {certTotal !== null && certificates.length < certTotal && (
            <p>Showing {certificates.length} of {certTotal} certificates. Only the first {certificates.length} are listed here.</p>
          )}
          {certificates.length === 0 && (
            <p>No certificates uploaded yet. Upload a PDF for a student marked Present to add one.</p>
          )}
          {message && <p>{message}</p>}
          <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>USN</th>
              <th>Certificate</th>
              <th>Upload</th>
              <th>Send tick</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => {
              const cert = certFor(r.id);
              return (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.usn}</td>
                  <td>
                    {cert ? (
                      <>
                        {cert.status}
                        {cert.mailError ? (
                          <span title={cert.mailError}> - Send failed - try again</span>
                        ) : (
                          ""
                        )}
                      </>
                    ) : (
                      "No certificate uploaded"
                    )}
                  </td>
                  <td>
                    <CertificateUpload
                      label="Upload PDF"
                      onUploaded={(url, name) => saveUpload(r.id, url, name)}
                    />
                  </td>
                  <td>
                    {cert && (cert.status === "UPLOADED" || cert.status === "FAILED") && (
                      <input
                        type="checkbox"
                        aria-label={`Send certificate to ${r.name}`}
                        checked={!!ticks[cert.id]}
                        onChange={(e) => setTicks((t) => ({ ...t, [cert.id]: e.target.checked }))}
                      />
                    )}
                  </td>
                  <td>
                    {cert && cert.status === "FAILED" && <button onClick={() => retry(cert.id)} disabled={busyKey === `retry:${cert.id}`}>{busyKey === `retry:${cert.id}` ? "Retrying..." : "Retry"}</button>}{" "}
                    {cert && cert.status !== "SENT" && cert.status !== "QUEUED" && (
                      <button onClick={() => hold(cert.id, cert.status === "HELD" ? "UNHOLD" : "HOLD")} disabled={busyKey === `hold:${cert.id}`}>
                        {cert.status === "HELD" ? "Unhold" : "Hold"}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p>
        <button onClick={sendTicked} disabled={busyKey === "send"}>{busyKey === "send" ? "Sending..." : "Send ticked certificates"}</button>
      </p>
      <p>
        After you press Send, the queue worker sends the mails in batches of 20. It runs on a schedule after
        deployment, every 5 minutes. Locally, it only runs when someone calls the queue route with the
        cron secret, so a QUEUED certificate will stay queued until that route is called.
      </p>
        </>
      )}
    </div>
  );
}
