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
    const payload = { ...form, feeAmount: form.feeAmount ? Number(form.feeAmount) : null };
    const url = eventId ? `/api/events/${form.slug}` : "/api/events";
    const method = eventId ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not save the event. Please check the fields and try again.");
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
    </form>
  );
}
