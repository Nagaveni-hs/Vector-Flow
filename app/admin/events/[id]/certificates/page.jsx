"use client";

import { useEffect, useState } from "react";
import CertificateUpload from "@/components/CertificateUpload";

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
export default function Certificates({ params }) {
  const [event, setEvent] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [ticks, setTicks] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploads, setUploads] = useState({});

  async function load() {
    const attRes = await fetch(`/api/admin/events/${params.id}/attendance`);
    const att = await attRes.json();
    if (!att.ok) {
      setError("Certificates are for admins only, or this event was not found.");
      return;
    }
    setEvent(att.data.event);
    setRegistrations(att.data.registrations.filter((r) => r.attendance === "PRESENT" && r.status === "REGISTERED"));
    const certRes = await fetch(`/api/admin/certificates?eventId=${params.id}`);
    const cert = await certRes.json();
    if (cert.ok) {
      setCertificates(cert.data.certificates);
      const t = {};
      cert.data.certificates.forEach((c) => {
        if (c.status === "UPLOADED" || c.status === "FAILED") t[c.id] = false;
      });
      setTicks(t);
    } else {
      // m39: a failed certificate-list fetch used to leave the list
      // empty, and every row wrongly said "No certificate uploaded".
      setError("Could not load the certificates. Please try again.");
    }
  }

  useEffect(() => {
    load();
  }, [params.id]);

  function certFor(registrationId) {
    return certificates.find((c) => c.registrationId === registrationId) || null;
  }

  async function saveUpload(registrationId, fileUrl, fileName) {
    setMessage("");
    const res = await fetch("/api/admin/certificates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ registrationId, fileUrl, fileName }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not save that certificate. Only Present students can get a certificate, and the file must be a PDF.");
      return;
    }
    setMessage("Certificate saved. It is held until you tick it and press Send.");
    load();
  }

  async function sendTicked() {
    const ids = Object.keys(ticks).filter((id) => ticks[id]);
    if (ids.length === 0) {
      setMessage("Please tick at least one certificate before you press Send.");
      return;
    }
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
  }

  async function retry(id) {
    const res = await fetch(`/api/admin/certificates/${id}/retry`, { method: "POST" });
    const json = await res.json();
    setMessage(json.ok ? "That certificate is queued again." : "Could not retry that certificate.");
    load();
  }

  async function hold(id, action) {
    const res = await fetch(`/api/admin/certificates/${id}/hold`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const json = await res.json();
    setMessage(json.ok ? (action === "HOLD" ? "Certificate held. No mail will be sent for it." : "Certificate is back to uploaded.") : "Could not change that certificate.");
    load();
  }

  const tickedCount = Object.keys(ticks).filter((id) => ticks[id]).length;
  // M16: "hold" counts only UPLOADED/FAILED certificates that are
  // unticked. Already-SENT and already-QUEUED ones are not held --
  // they were counted as holds before, overstating the number.
  const heldCount = registrations.filter((r) => {
    const cert = certFor(r.id);
    return cert && (cert.status === "UPLOADED" || cert.status === "FAILED") && !ticks[cert.id];
  }).length;

  if (error) return <p className="error">{error}</p>;
  if (!event) {
    return (
      <div className="admin-content-page certificates-page">
        <h1>Certificates</h1>
        <div className="skeleton-card" aria-label="Loading certificates">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      </div>
    );
  }
  return (
    <div className="admin-content-page certificates-page">
      <h1>Certificates for {event.title}</h1>
      <p>Only students marked Present are listed here.</p>
      <p>
        Preview: Send to {tickedCount}, hold {heldCount}. Held certificates get no mail and are not shown to the student.
      </p>
      {registrations.length === 0 && <p>No certificates yet. No student is marked Present for this event yet.</p>}
      {registrations.length > 0 && certificates.length === 0 && (
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
                    {cert ? `${cert.status}${cert.mailError ? ` - ${cert.mailError}` : ""}` : "No certificate uploaded"}
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
                        checked={!!ticks[cert.id]}
                        onChange={(e) => setTicks((t) => ({ ...t, [cert.id]: e.target.checked }))}
                      />
                    )}
                  </td>
                  <td>
                    {cert && cert.status === "FAILED" && <button onClick={() => retry(cert.id)}>Retry</button>}{" "}
                    {cert && cert.status !== "SENT" && cert.status !== "QUEUED" && (
                      <button onClick={() => hold(cert.id, cert.status === "HELD" ? "UNHOLD" : "HOLD")}>
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
        <button onClick={sendTicked}>Send ticked certificates</button>
      </p>
      <p>
        After you press Send, the queue worker sends the mails in batches of 20. It runs on a schedule after
        deployment, every 5 minutes. Locally, it only runs when someone calls the queue route with the
        cron secret, so a QUEUED certificate will stay queued until that route is called.
      </p>
    </div>
  );
}
