"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Sprint 3 admin dashboard. For each event it shows counts: total,
// paid and free, verified and pending payment, and present and
// absent attendance. For a selected event it shows the registration
// dashboard: search by name, USN, or email, filter by payment and
// attendance, a CSV download of the same filtered list, a screenshot
// modal, and Verify and Reject buttons with a reason box.
// Plain warning, shown on the page itself: before you press Verify,
// check the payment screenshot against this event's receiver name
// and amount. The site cannot check a screenshot automatically.
export default function Admin() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [counts, setCounts] = useState(null);
  const [search, setSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [screenshot, setScreenshot] = useState(null);

  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((j) => {
        setLoading(false);
        if (j.ok) setEvents(j.data.events);
        else setError("Admin access only. Please sign in as an admin.");
      })
      .catch(() => {
        setLoading(false);
        setError("Admin access only. Please sign in as an admin.");
      });
  }, []);

  async function loadRegistrations(event) {
    setSelected(event);
    setMessage("");
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (paymentFilter) params.set("payment", paymentFilter);
    if (attendanceFilter) params.set("attendance", attendanceFilter);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/admin/events/${event.id}/registrations${query}`);
    const json = await res.json();
    if (json.ok) {
      setRegistrations(json.data.registrations);
      setCounts(json.data.counts);
    }
  }

  async function paymentAction(registration, action) {
    setMessage("");
    if (action === "REJECT" && !reason.trim()) {
      setMessage("A reason is required to reject a payment. Please write it in the reason box first.");
      return;
    }
    const res = await fetch(`/api/admin/registrations/${registration.id}/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, reason: reason.trim() }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not update that payment. It may already have been verified or rejected.");
      return;
    }
    setMessage(
      json.data.mailStatus === "SENT"
        ? `Payment ${action === "VERIFY" ? "verified" : "rejected"} and mail sent to the student.`
        : `Payment ${action === "VERIFY" ? "verified" : "rejected"}, but the mail could not be sent. Check the mail settings.`
    );
    if (selected) loadRegistrations(selected);
  }

  // P1 (B9): re-send the verified/rejected mail without changing the
  // decision. Only for registrations whose payment was already
  // verified or rejected -- if the mail failed the first time, this
  // is the only way the student ever hears the decision.
  async function resendPaymentMail(registration) {
    setMessage("");
    const res = await fetch(`/api/admin/registrations/${registration.id}/payment/resend`, {
      method: "POST",
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not re-send that payment mail. Please try again.");
      return;
    }
    setMessage(
      json.data.mailStatus === "SENT"
        ? "Payment mail re-sent to the student."
        : "Payment mail could not be sent. Check the mail settings and try again."
    );
  }

  // M5: an admin can cancel any registration that is still
  // REGISTERED and not yet marked Present, before the event starts.
  // Paid cancellations are NOT refunded automatically -- payment was
  // manual UPI, so the admin must refund by hand outside the site.
  async function cancelRegistrationAdmin(registration) {
    setMessage("");
    const note =
      registration.event?.feeType === "PAID" || selected?.feeType === "PAID"
        ? " This was a paid registration: cancelling does not refund the money. Refund it by hand (UPI) outside the site."
        : "";
    if (!window.confirm(`Cancel the registration of ${registration.name} (${registration.usn})?${note}`)) {
      return;
    }
    const res = await fetch(`/api/registrations/${registration.id}/cancel`, {
      method: "POST",
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not cancel that registration. It may already be cancelled, attended, or past the event start.");
      return;
    }
    setMessage(
      json.data?.paidRefundNote
        ? `Registration cancelled. ${json.data.paidRefundNote}`
        : "Registration cancelled."
    );
    if (selected) loadRegistrations(selected);
  }

  function csvUrl() {
    if (!selected) return "#";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (paymentFilter) params.set("payment", paymentFilter);
    if (attendanceFilter) params.set("attendance", attendanceFilter);
    params.set("format", "csv");
    return `/api/admin/events/${selected.id}/registrations?${params.toString()}`;
  }

  if (loading) return <p>Loading...</p>;
  if (error) {
    return (
      <div className="admin-content-page">
        <h1>Admin</h1>
        <p>{error}</p>
      </div>
    );
  }
  return (
    <div className="admin-content-page admin-dashboard">
      <header className="page-heading page-heading--split">
        <div>
          <p className="page-eyebrow">Club operations</p>
          <h1>Admin dashboard</h1>
          <p>Manage events, registrations, attendance, and certificates.</p>
        </div>
      </header>
      <nav className="admin-dashboard__quick-links" aria-label="Admin shortcuts">
        <Link href="/admin/events/new">Create a new event</Link>
        <Link href="/admin/team">Team admin</Link>
        <Link href="/admin/handover">Admin handover note</Link>
        <Link href="/admin/checks">Local checks</Link>
      </nav>
      {events.length === 0 && <p className="empty-state">No events yet.</p>}
      {events.map((event) => (
        <article className="card admin-event-card" key={event.id}>
          <h2>{event.title}</h2>
          <p>
            {event.status} - {event.counts ? event.counts.total : event._count ? event._count.registrations : 0} registrations
          </p>
          {event.counts && (
            <p>
              Paid: {event.counts.paid} - Free: {event.counts.free} - Verified: {event.counts.verified} -{" "}
              Pending review: {event.counts.pendingReview} - Rejected: {event.counts.rejected} - Present:{" "}
              {event.counts.present} - Absent: {event.counts.absent}
            </p>
          )}
          <p>
            <Link href={`/admin/events/${event.slug}`}>Edit</Link>{" "}
            <button onClick={() => loadRegistrations(event)}>Show registrations</button>{" "}
            <Link href={`/admin/events/${event.id}/attendance`}>Attendance</Link>{" "}
            <Link href={`/admin/events/${event.id}/certificates`}>Certificates</Link>
          </p>
        </article>
      ))}
      {selected && (
        <section className="admin-registrations" aria-labelledby="admin-registrations-title">
          <h2 id="admin-registrations-title">Registrations for {selected.title}</h2>
          <p>
            Before you press Verify, check the payment screenshot against this event's receiver name and
            amount: {selected.paymentReceiverName || "No receiver set"} ({selected.paymentReceiverContact || "No contact set"})
            {selected.feeType === "PAID" ? `, Rs ${selected.feeAmount}` : ""}. The site cannot check a
            screenshot automatically.
          </p>
          <label>
            Search name, USN, or email
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Payment
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All payments</option>
              <option value="PENDING_REVIEW">Pending review</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="NOT_REQUIRED">Not required</option>
            </select>
          </label>
          <label>
            Attendance
            <select value={attendanceFilter} onChange={(e) => setAttendanceFilter(e.target.value)}>
              <option value="">All attendance</option>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="UNMARKED">Unmarked</option>
            </select>
          </label>
          <p>
            <button onClick={() => loadRegistrations(selected)}>Apply filters</button>{" "}
            <a href={csvUrl()}>Download CSV of this list</a>
          </p>
          {counts && (
            <p>
              Showing {counts.filtered} of {counts.total} registrations for this event.
            </p>
          )}
          <label>
            Reason for rejection (required when you reject)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: amount does not match this event" />
          </label>
          {message && <p>{message}</p>}
          {registrations.length === 0 && <p>No registrations match these filters.</p>}
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>USN</th>
                  <th>Email</th>
                  <th>Payment</th>
                  <th>Attendance</th>
                  <th>Status</th>
                  <th>Screenshot</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {registrations.map((r) => (
                  <tr key={r.id}>
                    <td>{r.name}</td>
                    <td>{r.usn}</td>
                    <td>{r.email}</td>
                    <td>
                      {r.paymentStatus}
                      {r.rejectionReason ? ` - Reason: ${r.rejectionReason}` : ""}
                    </td>
                    <td>{r.attendance}</td>
                    <td>
                      {r.status}
                      {r.status === "CANCELLED" ? " - cancelled, no refund sent automatically" : ""}
                    </td>
                    <td>
                      {r.paymentScreenshotUrl ? (
                        <button onClick={() => setScreenshot(r)}>View screenshot</button>
                      ) : (
                        "No screenshot"
                      )}
                    </td>
                    <td>
                      {r.paymentStatus === "PENDING_REVIEW" && (
                        <>
                          <button onClick={() => paymentAction(r, "VERIFY")}>Verify</button>{" "}
                          <button onClick={() => paymentAction(r, "REJECT")}>Reject</button>
                        </>
                      )}
                      {(r.paymentStatus === "VERIFIED" || r.paymentStatus === "REJECTED") && (
                        <button onClick={() => resendPaymentMail(r)}>Re-send mail</button>
                      )}{" "}
                      {r.status === "REGISTERED" && r.attendance !== "PRESENT" && (
                        <button onClick={() => cancelRegistrationAdmin(r)}>Cancel</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
      {screenshot && (
        <div className="modal">
          <div className="modal-box">
            <h2>Payment screenshot for {screenshot.name}</h2>
            <p>USN: {screenshot.usn} - Email: {screenshot.email}</p>
            <img src={screenshot.paymentScreenshotUrl} alt="Payment screenshot" />
            <p>
              <button onClick={() => setScreenshot(null)}>Close</button>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
