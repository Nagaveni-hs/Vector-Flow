"use client";

import { useState } from "react";
import FileUpload from "./FileUpload";

const EMPTY = {
  title: "", slug: "", description: "", posterImageUrl: "", venue: "",
  mode: "ONSITE", startAt: "", endAt: "", registrationOpensAt: "",
  registrationClosesAt: "", feeType: "FREE", feeAmount: "",
  paymentReceiverName: "", paymentReceiverContact: "", paymentQrImageUrl: "",
  registrationMode: "SITE", externalRegistrationUrl: "", driveLink: "",
  status: "DRAFT",
};

export default function EventForm({ initial, eventId }) {
  const [form, setForm] = useState(initial || EMPTY);
  const [message, setMessage] = useState("");
  // B1 (audit 2026-11-10): a datetime-local value is a bare wall-clock
  // string ("2026-11-10T10:00") with no timezone. The server reads it
  // as its own local time, so on a UTC server (Vercel) 10:00 IST was
  // stored as 10:00 UTC = 15:30 IST, and every re-edit drifted another
  // 5h30. The admin always means IST, so attach the explicit +05:30
  // offset before sending; new Date() on the server then stores the
  // same instant whatever the server timezone is. Values that already
  // carry an offset are passed through unchanged.
  function toISTISOString(value) {
    if (!value) return value;
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/.test(value)) {
      return `${value}+05:30`;
    }
    return value;
  }
  // P1 (B6): the slug the event had when this form opened. The PUT
  // goes to that original slug, so editing the slug field still saves
  // instead of 404ing on the new slug (which does not exist yet).
  const [originalSlug] = useState(initial?.slug || "");
  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function submit(e) {
    e.preventDefault();
    setMessage("");
    if (form.feeType === "PAID" && (!form.feeAmount || !form.paymentReceiverName || !form.paymentReceiverContact || !form.paymentQrImageUrl)) {
      setMessage("Paid events need an amount, receiver name, receiver contact, and a QR image.");
      return;
    }
    if (form.registrationMode === "EXTERNAL" && !form.externalRegistrationUrl) {
      setMessage("External events need an external registration link.");
      return;
    }
    // P1 (M11): normalise the slug the same way the server does, so
    // "My Event!" becomes "my-event" before it is sent. The server
    // re-checks it and refuses a slug that is still invalid.
    const slug = String(form.slug || "")
      .trim()
      .toLowerCase()
      .replace(/[\s_]+/g, "-")
      .replace(/[^a-z0-9-]/g, "")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "");
    const payload = {
      ...form,
      slug,
      feeAmount: form.feeAmount ? Number(form.feeAmount) : null,
      startAt: toISTISOString(form.startAt),
      endAt: toISTISOString(form.endAt),
      registrationOpensAt: toISTISOString(form.registrationOpensAt),
      registrationClosesAt: toISTISOString(form.registrationClosesAt),
    };
    // P1 (B6): PUT to the ORIGINAL slug, not the (possibly edited) one.
    const url = eventId ? `/api/events/${originalSlug || slug}` : "/api/events";
    const method = eventId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage(
        json.error === "INVALID_SLUG"
          ? "That slug is not usable. Use lowercase letters, numbers, and dashes only."
          : json.error === "PAYMENT_REQUIRED"
            ? "Paid events need an amount, receiver name, receiver contact, and a QR image."
            : "Could not save the event. Please check the fields and try again."
      );
      return;
    }
    setMessage("Event saved.");
    if (!eventId) window.location.href = "/admin";
  }
  return (
    <form className="event-form" onSubmit={submit}>
      <label>Title<input value={form.title} onChange={(e) => set("title", e.target.value)} required /></label>
      <label>Slug (letters, numbers, and dashes only)<input value={form.slug} onChange={(e) => set("slug", e.target.value)} required /></label>
      <label>Description<textarea value={form.description} onChange={(e) => set("description", e.target.value)} required /></label>
      <FileUpload folder="vector-flow/posters" label="Poster image" onUploaded={(url) => set("posterImageUrl", url)} />
      {form.posterImageUrl && <p>Poster: {form.posterImageUrl}</p>}
      <label>Venue<input value={form.venue} onChange={(e) => set("venue", e.target.value)} /></label>
      <label>Mode
        <select value={form.mode} onChange={(e) => set("mode", e.target.value)}>
          <option value="ONSITE">Onsite</option>
          <option value="ONLINE">Online</option>
        </select>
      </label>
      <label>Start date and time<input type="datetime-local" value={form.startAt} onChange={(e) => set("startAt", e.target.value)} required /></label>
      <label>End date and time<input type="datetime-local" value={form.endAt} onChange={(e) => set("endAt", e.target.value)} /></label>
      <label>Registration opens<input type="datetime-local" value={form.registrationOpensAt} onChange={(e) => set("registrationOpensAt", e.target.value)} /></label>
      <label>Registration closes<input type="datetime-local" value={form.registrationClosesAt} onChange={(e) => set("registrationClosesAt", e.target.value)} /></label>
      <label>Fee type
        <select value={form.feeType} onChange={(e) => set("feeType", e.target.value)}>
          <option value="FREE">Free</option>
          <option value="PAID">Paid</option>
        </select>
      </label>
      {form.feeType === "PAID" && (
        <>
          <label>Fee amount (rupees)<input type="number" min="1" value={form.feeAmount} onChange={(e) => set("feeAmount", e.target.value)} /></label>
          <label>Payment receiver name<input value={form.paymentReceiverName} onChange={(e) => set("paymentReceiverName", e.target.value)} /></label>
          <label>Payment receiver contact<input value={form.paymentReceiverContact} onChange={(e) => set("paymentReceiverContact", e.target.value)} /></label>
          <FileUpload folder="vector-flow/qr" label="Payment QR image" onUploaded={(url) => set("paymentQrImageUrl", url)} />
          {form.paymentQrImageUrl && <p>QR: {form.paymentQrImageUrl}</p>}
        </>
      )}
      <label>Registration mode
        <select value={form.registrationMode} onChange={(e) => set("registrationMode", e.target.value)}>
          <option value="SITE">On this site</option>
          <option value="EXTERNAL">External form</option>
        </select>
      </label>
      {form.registrationMode === "EXTERNAL" && (
        <label>External registration link<input value={form.externalRegistrationUrl} onChange={(e) => set("externalRegistrationUrl", e.target.value)} /></label>
      )}
      <label>Drive link<input value={form.driveLink} onChange={(e) => set("driveLink", e.target.value)} /></label>
      <label>Status
        <select value={form.status} onChange={(e) => set("status", e.target.value)}>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ONGOING">Ongoing</option>
          <option value="COMPLETED">Completed</option>
          <option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <button type="submit">Save event</button>
      {message && <p>{message}</p>}
      {message === "Event saved." && eventId && (
        <p>
          <a href="/admin">Back to dashboard</a>
        </p>
      )}
    </form>
  );
}
