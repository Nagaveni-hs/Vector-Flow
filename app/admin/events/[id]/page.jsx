"use client";

import { useEffect, useState } from "react";
import EventForm from "@/components/EventForm";

function toLocal(value) {
  if (!value) return "";
  return new Date(value).toISOString().slice(0, 16);
}

export default function EditEvent({ params }) {
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState("");
  const [preview, setPreview] = useState(null);
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
  useEffect(() => {
    fetch(`/api/admin/events/${params.id}/announce`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setPreview(j.data);
      })
      .catch(() => {});
  }, [params.id]);
  async function sendAnnouncement() {
    setAnnouncing(true);
    setAnnounceMessage("");
    const res = await fetch(`/api/admin/events/${params.id}/announce`, { method: "POST" });
    const j = await res.json();
    setAnnouncing(false);
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
  }
  if (error) return <p className="error">{error}</p>;
  if (!initial) return <p>Loading...</p>;
  return (
    <div className="admin-content-page event-edit-page">
      <h1>Edit event</h1>
      <EventForm initial={initial} eventId={params.id} />
      <section className="card announcement-panel">
        <h2>Announcement mail</h2>
        <p>Editing this event afterwards does not send the announcement again.</p>
        {!preview && <p>Loading preview...</p>}
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
