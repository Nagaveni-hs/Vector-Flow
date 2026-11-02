"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FileUpload from "@/components/FileUpload";
import StatusBadge from "@/components/StatusBadge";

const HUMAN = {
  NOT_SIGNED_IN: "Please sign in first.",
  NOT_COLLEGE_EMAIL: "Please sign in with a college email ending in @vvce.ac.in.",
  EVENT_NOT_FOUND: "This event was not found.",
  REGISTRATION_CLOSED: "Registration is closed for this event.",
  ALREADY_REGISTERED: "You are already registered for this event.",
  PAYMENT_REQUIRED: "A paid event needs a payment screenshot.",
  INVALID_FILE: "Please check the form and try again.",
};

export default function EventDetail({ params }) {
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", usn: "", email: "", branch: "", semester: "", phone: "", paymentScreenshotUrl: "" });
  const [message, setMessage] = useState("");
  useEffect(() => {
    fetch(`/api/events/${params.slug}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEvent(j.data.event);
        else setError("This event was not found.");
      })
      .catch(() => setError("This event was not found."));
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setUser(j.data.user);
          setForm((f) => ({
            ...f,
            name: j.data.user.name || "",
            email: j.data.user.email || "",
            usn: j.data.user.usn || "",
            branch: j.data.user.branch || "",
            semester: j.data.user.semester ? String(j.data.user.semester) : "",
            phone: j.data.user.phone || "",
          }));
        }
      })
      .catch(() => {});
  }, [params.slug]);
  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function register(e) {
    e.preventDefault();
    setMessage("");
    if (event.feeType === "PAID" && !form.paymentScreenshotUrl) {
      setMessage(HUMAN.PAYMENT_REQUIRED);
      return;
    }
    const res = await fetch(`/api/events/${params.slug}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, semester: form.semester ? Number(form.semester) : null }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(HUMAN[json.error] || HUMAN.INVALID_FILE);
      return;
    }
    setMessage("You are registered. You can see this event on Participation.");
  }
  if (error) return <p className="error">{error}</p>;
  if (!event) return <p>Loading...</p>;
  return (
    <div>
      {event.posterImageUrl && <img src={event.posterImageUrl} alt={event.title} />}
      <h1>{event.title}</h1>
      <p>
        <StatusBadge value={event.feeType === "PAID" ? `Rs ${event.feeAmount}` : "Free"} />
        <StatusBadge value={event.status} />
      </p>
      <p>{event.description}</p>
      <p>
        {event.startAt && new Date(event.startAt).toLocaleString()}
        {event.venue ? ` - ${event.venue}` : ""} - {event.mode}
      </p>
      {event.feeType === "PAID" && (
        <div className="card">
          <p>Pay to: {event.paymentReceiverName} ({event.paymentReceiverContact})</p>
          <p>Amount: Rs {event.feeAmount}</p>
          {event.paymentQrImageUrl && <img src={event.paymentQrImageUrl} alt="Payment QR" />}
        </div>
      )}
      {event.registrationMode === "EXTERNAL" ? (
        <p>
          <a href={event.externalRegistrationUrl} target="_blank" rel="noreferrer">
            Register on the external form
          </a>
        </p>
      ) : !user ? (
        <p>
          <Link href="/signin">Sign in</Link> to register.
        </p>
      ) : (
        <form onSubmit={register}>
          <h2>Register</h2>
          <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
          <label>USN<input value={form.usn} onChange={(e) => set("usn", e.target.value)} required /></label>
          <label>College email<input value={form.email} onChange={(e) => set("email", e.target.value)} required /></label>
          <label>Branch<input value={form.branch} onChange={(e) => set("branch", e.target.value)} /></label>
          <label>Semester<input type="number" value={form.semester} onChange={(e) => set("semester", e.target.value)} /></label>
          <label>Phone (optional)<input value={form.phone} onChange={(e) => set("phone", e.target.value)} /></label>
          {event.feeType === "PAID" && (
            <>
              <FileUpload folder="vector-flow/screenshots" label="Payment screenshot" onUploaded={(url) => set("paymentScreenshotUrl", url)} />
              {form.paymentScreenshotUrl && <p>Screenshot uploaded.</p>}
            </>
          )}
          <button type="submit">Register</button>
          {message && <p>{message}</p>}
        </form>
      )}
    </div>
  );
}
