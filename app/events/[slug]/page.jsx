"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FileUpload from "@/components/FileUpload";
import Skeleton from "@/components/Skeleton";
import StatusBadge from "@/components/StatusBadge";
import Toast, { useToast } from "@/components/Toast";

const HUMAN = {
  NOT_SIGNED_IN: "Please sign in first.",
  NOT_COLLEGE_EMAIL: "Please sign in with a college email ending in @vvce.ac.in.",
  EVENT_NOT_FOUND: "This event was not found.",
  REGISTRATION_CLOSED: "Registration is closed for this event.",
  ALREADY_REGISTERED: "You are already registered for this event.",
  PAYMENT_REQUIRED: "A paid event needs a payment screenshot.",
  INVALID_FILE: "Please check the form and try again.",
};

function formatEventDate(value, options) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  // m18: pin IST, like participation and gallery do, so the same
  // event never shows a different day/time on a non-IST device.
  return new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", ...options }).format(date);
}

export default function EventDetail({ params }) {
  const [event, setEvent] = useState(null);
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ name: "", usn: "", email: "", branch: "", semester: "", phone: "", paymentScreenshotUrl: "" });
  const { toast, showToast, hideToast } = useToast();
  // M14: disable the submit button while the request runs and after
  // success, so a double click cannot submit twice.
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    // m18: a 404 (or a draft the visitor may not see) is "not
    // found"; any other failure is a load problem, not a missing
    // event, so the two get different copy below.
    fetch(`/api/events/${params.slug}`)
      .then((r) =>
        r
          .json()
          .catch(() => null)
          .then((j) => ({ status: r.status, json: j }))
      )
      .then(({ status, json }) => {
        if (json && json.ok) setEvent(json.data.event);
        else if (status === 404 || (json && json.error === "EVENT_NOT_FOUND")) setError("not-found");
        else setError("load-failed");
      })
      .catch(() => setError("load-failed"));
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
    if (submitting || registered) return;
    if (event.feeType === "PAID" && !form.paymentScreenshotUrl) {
      showToast(HUMAN.PAYMENT_REQUIRED, "error");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/events/${params.slug}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, semester: form.semester ? Number(form.semester) : null }),
      });
      const json = await res.json();
      if (!json.ok) {
        showToast(HUMAN[json.error] || HUMAN.INVALID_FILE, "error");
        return;
      }
      setRegistered(true);
      showToast("You are registered. You can see this event on Participation.", "success");
    } catch {
      showToast(HUMAN.INVALID_FILE, "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (error) {
    return (
      <div className="event-detail-state">
        <p className="event-detail-eyebrow">Event</p>
        {error === "load-failed" ? (
          <>
            <h1>This event could not be loaded.</h1>
            <p>Check your connection and try again.</p>
            <p>
              <button type="button" onClick={() => window.location.reload()}>
                Try again
              </button>
            </p>
          </>
        ) : (
          <>
            <h1>This event could not be found.</h1>
          </>
        )}
        <Link className="event-detail-back" href="/">← Back to Vector Flow</Link>
      </div>
    );
  }
  if (!event) {
    return (
      <div className="event-detail" aria-label="Loading event details" aria-busy="true">
        <Skeleton variant="text" count={1} />
        <section className="event-detail-hero" aria-hidden="true">
          <div className="skeleton skeleton-hero-poster" />
          <div className="event-detail-hero__content">
            <Skeleton variant="text" count={4} />
          </div>
        </section>
        <div className="event-detail-layout">
          <div className="event-detail-main">
            <Skeleton variant="card" count={1} />
          </div>
          <Skeleton variant="card" count={1} />
        </div>
      </div>
    );
  }

  const eventDate = formatEventDate(event.startAt, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const eventTime = formatEventDate(event.startAt, {
    hour: "numeric",
    minute: "2-digit",
  });
  const eventEndTime = formatEventDate(event.endAt, {
    hour: "numeric",
    minute: "2-digit",
  });
  const eventEndDate = formatEventDate(event.endAt, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const endsOnDifferentDay =
    event.startAt &&
    event.endAt &&
    new Date(event.startAt).toDateString() !== new Date(event.endAt).toDateString();
  const feeLabel = event.feeType === "PAID" ? `₹${event.feeAmount}` : "Free";
  const registrationHref = event.registrationMode === "EXTERNAL"
    ? event.externalRegistrationUrl
    : user
      ? "#event-registration"
      : "/signin";

  return (
    <article className="event-detail">
      <Link className="event-detail-back" href="/">
        <span aria-hidden="true">←</span> All events
      </Link>

      <section className="event-detail-hero" aria-labelledby="event-title">
        <div className="event-detail-hero__poster">
          {event.posterImageUrl ? (
            <img src={event.posterImageUrl} alt={`${event.title} event poster`} />
          ) : (
            <div className="event-detail-hero__poster-placeholder" aria-hidden="true">
              <span>VECTOR FLOW</span>
              <span>EVENT</span>
            </div>
          )}
        </div>

        <div className="event-detail-hero__content">
          <p className="event-detail-eyebrow">
            <span className="event-detail-eyebrow__dot" aria-hidden="true" />
            VVCE · CSE (AI &amp; ML)
          </p>
          <div className="event-detail-badges">
            <StatusBadge value={feeLabel} />
          </div>
          <h1 id="event-title">{event.title}</h1>
          <p className="event-detail-hero__description">{event.description}</p>

          <div className="event-detail-hero__facts">
            <div className="event-detail-fact">
              <span className="event-detail-fact__icon" aria-hidden="true">◷</span>
              <span>
                <strong>{eventDate || "Date to be announced"}</strong>
                <span>
                  {eventTime || "Time to be announced"}
                  {eventEndTime ? ` – ${eventEndTime}` : ""}
                  {endsOnDifferentDay && eventEndDate ? ` · ends ${eventEndDate}` : ""}
                </span>
              </span>
            </div>
            <div className="event-detail-fact">
              <span className="event-detail-fact__icon" aria-hidden="true">⌖</span>
              <span>
                <strong>{event.venue || (event.mode === "ONLINE" ? "Online event" : "Venue to be announced")}</strong>
                <span>{event.mode === "ONLINE" ? "Online" : "On campus"}</span>
              </span>
            </div>
            <div className="event-detail-fact">
              <span className="event-detail-fact__icon" aria-hidden="true">₹</span>
              <span>
                <strong>{feeLabel}</strong>
                <span>{event.feeType === "PAID" ? "Participation fee" : "No participation fee"}</span>
              </span>
            </div>
          </div>

          <a
            className="event-detail-cta"
            href={registrationHref}
            target={event.registrationMode === "EXTERNAL" ? "_blank" : undefined}
            rel={event.registrationMode === "EXTERNAL" ? "noreferrer" : undefined}
          >
            {event.registrationMode === "EXTERNAL"
              ? "Register on external form"
              : user
                ? "Register for this event"
                : "Sign in to register"}
            <span aria-hidden="true">→</span>
          </a>
        </div>
      </section>

      <div className="event-detail-layout">
        <div className="event-detail-main">
          <section className="event-detail-section" aria-labelledby="event-about-title">
            <p className="event-detail-section__eyebrow">The experience</p>
            <h2 id="event-about-title">About this event</h2>
            <div className="event-detail-description">
              {event.description.split(/\n{2,}/).map((paragraph, index) => (
                <p key={`${index}-${paragraph}`}>{paragraph}</p>
              ))}
            </div>
          </section>

          {event.feeType === "PAID" && (
            <section className="event-payment-card" aria-labelledby="payment-title">
              <div className="event-payment-card__heading">
                <span className="event-payment-card__icon" aria-hidden="true">₹</span>
                <div>
                  <p className="event-detail-section__eyebrow">Payment details</p>
                  <h2 id="payment-title">Complete your payment</h2>
                </div>
              </div>
              <p className="event-payment-card__intro">
                Pay the event fee using the details below, then upload your payment screenshot in the registration form.
              </p>
              <div className="event-payment-card__details">
                <div>
                  <span>Amount</span>
                  <strong>₹{event.feeAmount}</strong>
                </div>
                <div>
                  <span>Pay to</span>
                  <strong>{event.paymentReceiverName}</strong>
                </div>
                <div>
                  <span>Contact</span>
                  <strong>{event.paymentReceiverContact}</strong>
                </div>
              </div>
              {event.paymentQrImageUrl && (
                <div className="event-payment-card__qr">
                  <img src={event.paymentQrImageUrl} alt={`Payment QR code for ${event.title}`} />
                  <p>Scan the QR code with your UPI app.</p>
                </div>
              )}
            </section>
          )}
        </div>

        <aside className="event-registration-card" id="event-registration" aria-labelledby="registration-title">
          <div className="event-registration-card__heading">
            <p className="event-detail-section__eyebrow">Be part of it</p>
            <h2 id="registration-title">
              {event.registrationMode === "EXTERNAL"
                ? "Ready to join?"
                : user
                  ? "Save your spot"
                  : "Join this event"}
            </h2>
            <p>
              {event.registrationMode === "EXTERNAL"
                ? "Continue to the event registration form."
                : user
                  ? "Add your details below to register."
                  : "Sign in with your college account to register."}
            </p>
          </div>

          {event.registrationMode === "EXTERNAL" ? (
            <a className="event-registration-submit" href={event.externalRegistrationUrl} target="_blank" rel="noreferrer">
              Register on the external form <span aria-hidden="true">↗</span>
            </a>
          ) : !user ? (
            <Link className="event-registration-submit" href="/signin">
              Sign in to register <span aria-hidden="true">→</span>
            </Link>
          ) : (
            <form className="event-registration-form" onSubmit={register}>
              <div className="event-registration-form__grid">
                <label>
                  Name
                  <input value={form.name} onChange={(e) => set("name", e.target.value)} required autoComplete="name" />
                </label>
                <label>
                  USN
                  <input value={form.usn} onChange={(e) => set("usn", e.target.value)} required autoComplete="off" />
                </label>
                <label className="event-registration-form__wide">
                  College email
                  <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} required autoComplete="email" />
                </label>
                <label>
                  Branch
                  <input value={form.branch} onChange={(e) => set("branch", e.target.value)} autoComplete="organization-title" />
                </label>
                <label>
                  Semester
                  <input type="number" value={form.semester} onChange={(e) => set("semester", e.target.value)} min="1" max="12" inputMode="numeric" />
                </label>
                <label className="event-registration-form__wide">
                  Phone <span className="event-registration-form__optional">(optional)</span>
                  <input type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" />
                </label>
              </div>

              {event.feeType === "PAID" && (
                <div className="event-registration-form__upload">
                  <FileUpload
                    folder="vector-flow/screenshots"
                    label="Payment screenshot"
                    onUploaded={(url) => set("paymentScreenshotUrl", url)}
                  />
                  {form.paymentScreenshotUrl && (
                    <p className="event-registration-form__upload-success" role="status">
                      Screenshot uploaded and ready to submit.
                    </p>
                  )}
                  <p className="event-registration-form__hint">
                    Upload a clear image of your payment confirmation, up to 5 MB.
                  </p>
                </div>
              )}

              <button className="event-registration-submit" type="submit" disabled={submitting || registered}>
                {submitting ? (<><span className="btn-spinner" aria-hidden="true" /> Registering...</>) : registered ? "Registered" : (<>Register for this event <span aria-hidden="true">→</span></>)}
              </button>
              <Toast toast={toast} onClose={hideToast} />
            </form>
          )}
        </aside>
      </div>
    </article>
  );
}
