"use client";

import { useEffect, useState } from "react";
import EventForm from "@/components/EventForm";
import Skeleton from "@/components/Skeleton";

// P1 (B5): format in Asia/Kolkata local time, not UTC. The old
// code used toISOString() (UTC), so an event at 10:00 IST was shown
// as "04:30" in the datetime-local input, and saving it wrote back
// 04:30 IST -- every edit shifted all times 5h30m earlier.
// datetime-local inputs are read as local time, so the value shown
// here must be the club's local (IST) wall-clock time.
function toLocal(value) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

export default function EditEvent({ params }) {
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const [announceMessage, setAnnounceMessage] = useState("");
  const [announcing, setAnnouncing] = useState(false);
  useEffect(() => {
    fetch(`/api/events/${params.id}`)
      .then((r) => r.json())
      .then((j) => {
        if (!j.ok) {
          setError("Event not found or admin access only.");
          return;
        }
        const e = j.data.event;
        setInitial({
          title: e.title || "",
          slug: e.slug || "",
          description: e.description || "",
          posterImageUrl: e.posterImageUrl || "",
          venue: e.venue || "",
          mode: e.mode || "ONSITE",
          startAt: toLocal(e.startAt),
          endAt: toLocal(e.endAt),
          registrationOpensAt: toLocal(e.registrationOpensAt),
          registrationClosesAt: toLocal(e.registrationClosesAt),
          feeType: e.feeType || "FREE",
          feeAmount: e.feeAmount ? String(e.feeAmount) : "",
          paymentReceiverName: e.paymentReceiverName || "",
          paymentReceiverContact: e.paymentReceiverContact || "",
          paymentQrImageUrl: e.paymentQrImageUrl || "",
          registrationMode: e.registrationMode || "SITE",
          externalRegistrationUrl: e.externalRegistrationUrl || "",
          driveLink: e.driveLink || "",
          status: e.status || "DRAFT",
        });
      })
      .catch(() => setError("Event not found or admin access only."));
  }, [params.id]);
  // M13: a failed preview fetch used to leave "Loading preview..."
  // on screen forever, because the failure was swallowed silently.
  // Now it shows an error with a retry button.
  function loadPreview() {
    setPreviewError(false);
    fetch(`/api/admin/events/${params.id}/announce`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPreview(j.data);
        else setPreviewError(true);
      })
      .catch(() => setPreviewError(true));
  }
  useEffect(() => {
    loadPreview();
  }, [params.id]);
  async function sendAnnouncement() {
    // M8: mass mail to the whole students group is one-way, so ask
    // first and name the audience before anything is sent.
    if (
      !window.confirm(
        `Send this announcement to all students (${preview ? preview.to : "the students group"})? This mails everyone at once and cannot be undone.`
      )
    )
      return;
    setAnnouncing(true);
    setAnnounceMessage("");
    try {
      const res = await fetch(`/api/admin/events/${params.id}/announce`, { method: "POST" });
      const j = await res.json();
      if (!j.ok) {
        setAnnounceMessage(
          j.error === "ANNOUNCEMENT_ALREADY_SENT"
            ? "This announcement was already sent. Sending again is blocked."
            : "Announcement mail failed to send. Nothing was marked as sent, so you can try again."
        );
        return;
      }
      setAnnounceMessage("Announcement sent to the students group.");
      setPreview((p) => (p ? { ...p, alreadySent: true, announcementSentAt: j.data.announcementSentAt } : p));
    } catch {
      setAnnounceMessage("Announcement mail failed to send. Nothing was marked as sent, so you can try again.");
    } finally {
      setAnnouncing(false);
    }
  }
  if (error) return <p className="error">{error}</p>;
  if (!initial)
    return (
      <div className="admin-content-page event-edit-page" aria-label="Loading event" aria-busy="true">
        <Skeleton variant="row" count={3} />
      </div>
    );
  return (
    <div className="admin-content-page event-edit-page">
      <h1>Edit event</h1>
      <EventForm initial={initial} eventId={params.id} />
      <section className="card announcement-panel">
        <h2>Announcement mail</h2>
        <p>Editing this event afterwards does not send the announcement again.</p>
        {!preview && !previewError && (
          <div aria-label="Loading announcement preview">
            <Skeleton variant="row" count={3} />
          </div>
        )}
        {!preview && previewError && (
          <p>
            Could not load the announcement preview.{" "}
            <button onClick={loadPreview}>Try again</button>
          </p>
        )}
        {preview && preview.alreadySent && (
          <p>Announcement already sent. Sending again is blocked.</p>
        )}
        {preview && !preview.alreadySent && (
          <div>
            <p>
              <strong>To:</strong> {preview.to}
            </p>
            <p>
              <strong>Subject:</strong> {preview.subject}
            </p>
            <pre style={{ whiteSpace: "pre-wrap" }}>{preview.body}</pre>
            <button onClick={sendAnnouncement} disabled={announcing}>
              {announcing ? "Sending..." : "Send announcement"}
            </button>
          </div>
        )}
        {announceMessage && <p>{announceMessage}</p>}
      </section>
    </div>
  );
}
