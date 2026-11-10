"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Toast, { useToast } from "@/components/Toast";

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
  const [paymentTypeFilter, setPaymentTypeFilter] = useState("");
  const [attendanceFilter, setAttendanceFilter] = useState("");
  const [busyKey, setBusyKey] = useState(null);
  const [reason, setReason] = useState("");
  const { toast, showToast, hideToast } = useToast();
  const [screenshot, setScreenshot] = useState(null);

  // M15: the screenshot modal closes with Escape or a backdrop click,
  // same pattern as the certificate viewer modal on Participation.
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") setScreenshot(null);
    }
    if (screenshot) window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [screenshot]);

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

  async function loadRegistrations(event, overrides = {}) {
    setSelected(event);
    const params = new URLSearchParams();
    const qSearch = overrides.search !== undefined ? overrides.search : search;
    const qPayment = overrides.payment !== undefined ? overrides.payment : paymentFilter;
    const qAttendance = overrides.attendance !== undefined ? overrides.attendance : attendanceFilter;
    if (qSearch) params.set("search", qSearch);
    if (qPayment) params.set("payment", qPayment);
    if (qAttendance) params.set("attendance", qAttendance);
    const query = params.toString() ? `?${params.toString()}` : "";
    const res = await fetch(`/api/admin/events/${event.id}/registrations${query}`);
    const json = await res.json();
    if (json.ok) {
      setRegistrations(json.data.registrations);
      setCounts(json.data.counts);
    }
  }

  async function paymentAction(registration, action) {
    if (action === "REJECT" && !reason.trim()) {
      showToast("A reason is required to reject a payment. Please write it in the reason box first.", "error");
      return;
    }
    if (action === "REJECT" && !window.confirm(`Reject the payment of ${registration.name} (${registration.usn})? The student will be mailed the reason: ${reason.trim()}`)) {
      return;
    }
    const key = `${registration.id}:${action}`;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, reason: reason.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        showToast("Could not update that payment. It may already have been verified or rejected.", "error");
        return;
      }
      showToast(
        json.data.mailStatus === "SENT"
          ? `Payment ${action === "VERIFY" ? "verified" : "rejected"} and mail sent to the student.`
          : `Payment ${action === "VERIFY" ? "verified" : "rejected"}, but the mail could not be sent. Check the mail settings.`,
        json.data.mailStatus === "SENT" ? "success" : "info"
      );
      if (selected) loadRegistrations(selected);
    } catch {
      showToast("Could not update that payment. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  // P1 (B9): re-send the verified/rejected mail without changing the
  // decision. Only for registrations whose payment was already
  // verified or rejected -- if the mail failed the first time, this
  // is the only way the student ever hears the decision.
  async function resendPaymentMail(registration) {
    const key = `${registration.id}:RESEND`;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/registrations/${registration.id}/payment/resend`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.ok) {
        showToast("Could not re-send that payment mail. Please try again.", "error");
        return;
      }
      showToast(
        json.data.mailStatus === "SENT"
          ? "Payment mail re-sent to the student."
          : "Payment mail could not be sent. Check the mail settings and try again.",
        json.data.mailStatus === "SENT" ? "success" : "info"
      );
    } catch {
      showToast("Could not re-send that payment mail. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  // M5: an admin can cancel any registration that is still
  // REGISTERED and not yet marked Present, before the event starts.
  // Paid cancellations are NOT refunded automatically -- payment was
  // manual UPI, so the admin must refund by hand outside the site.
  async function cancelRegistrationAdmin(registration) {
    const note =
      registration.event?.feeType === "PAID" || selected?.feeType === "PAID"
        ? " This was a paid registration: cancelling does not refund the money. Refund it by hand (UPI) outside the site."
        : "";
    if (!window.confirm(`Cancel the registration of ${registration.name} (${registration.usn})?${note}`)) {
      return;
    }
    const key = `${registration.id}:CANCEL`;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/registrations/${registration.id}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.ok) {
        showToast("Could not cancel that registration. It may already be cancelled, attended, or past the event start.", "error");
        return;
      }
      showToast(
        json.data?.paidRefundNote
          ? `Registration cancelled. ${json.data.paidRefundNote}`
          : "Registration cancelled.",
        "success"
      );
      if (selected) loadRegistrations(selected);
    } catch {
      showToast("Could not cancel that registration. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
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

  // Client-side filtering of the loaded list: typing in the search
  // box or changing a filter updates the rows at once, with no extra
  // fetch. The Apply filters button still re-fetches the same
  // search / payment-status / attendance filters from the server.
  // The paid/free type filter is client-side only: a paid row is any
  // row whose payment status is not NOT_REQUIRED.
  const filteredRegistrations = registrations.filter((r) => {
    const q = search.trim().toLowerCase();
    if (
      q &&
      !(
        String(r.name || "").toLowerCase().includes(q) ||
        String(r.usn || "").toLowerCase().includes(q) ||
        String(r.email || "").toLowerCase().includes(q)
      )
    ) {
      return false;
    }
    if (paymentTypeFilter === "PAID" && r.paymentStatus === "NOT_REQUIRED") return false;
    if (paymentTypeFilter === "FREE" && r.paymentStatus !== "NOT_REQUIRED") return false;
    if (paymentFilter && r.paymentStatus !== paymentFilter) return false;
    if (attendanceFilter && r.attendance !== attendanceFilter) return false;
    return true;
  });

  function clearFilters() {
    setSearch("");
    setPaymentTypeFilter("");
    setPaymentFilter("");
    setAttendanceFilter("");
    if (selected) loadRegistrations(selected, { search: "", payment: "", attendance: "" });
  }

  // Admin redesign: the dashboard is an overview, not a second
  // navigation. Every number below comes from the events the page
  // already loads (GET /api/admin/events, which carries per-event
  // counts) — no new API route, no extra fetch.
  const totalRegistrations = events.reduce((n, e) => n + (e.counts ? e.counts.total : 0), 0);
  const pendingPayments = events.reduce((n, e) => n + (e.counts ? e.counts.pendingReview : 0), 0);
  const presentTotal = events.reduce((n, e) => n + (e.counts ? e.counts.present : 0), 0);

  // What needs attention next, in plain words. Payments come from
  // the per-event counts; unmarked attendance is total minus marked;
  // the certificate nudge is for an ended event with Present
  // students. What is NOT here, and why: how many certificates are
  // still unsent is not in the dashboard data — it lives on each
  // event's Certificates page, linked from the event card below —
  // and adding a new aggregate route just for that number would be
  // a bigger change than this redesign needs.
  const attention = [];
  events.forEach((event) => {
    const c = event.counts;
    if (!c) return;
    if (c.pendingReview > 0) {
      attention.push({
        key: `${event.id}-payments`,
        text: `${c.pendingReview} payment${c.pendingReview === 1 ? "" : "s"} need${c.pendingReview === 1 ? "s" : ""} review for ${event.title}.`,
        action: "review",
        event,
      });
    }
    const unmarked = c.total - c.present - c.absent;
    if (c.total > 0 && unmarked > 0) {
      attention.push({
        key: `${event.id}-attendance`,
        text: `Attendance is unmarked for ${unmarked} of ${c.total} registrations in ${event.title}.`,
        href: `/admin/events/${event.id}/attendance`,
        label: "Mark attendance",
      });
    }
    const ended = event.endAt && new Date(event.endAt) < new Date();
    if (ended && c.present > 0) {
      attention.push({
        key: `${event.id}-certificates`,
        text: `${c.present} student${c.present === 1 ? " is" : "s are"} marked Present in ${event.title} — upload and send their certificates.`,
        href: `/admin/events/${event.id}/certificates`,
        label: "Open certificates",
      });
    }
  });

  function formatDate(value) {
    if (!value) return "";
    return new Date(value).toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  if (loading)
    return (
      <div className="admin-content-page" aria-label="Loading admin dashboard" aria-busy="true">
        <div className="skeleton-card">
          <div className="skeleton-row" />
          <div className="skeleton-row" />
          <div className="skeleton-row" />
        </div>
      </div>
    );
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
      <section className="admin-overview" aria-labelledby="admin-overview-title">
        <h2 id="admin-overview-title">At a glance</h2>
        <ul className="admin-overview__counts">
          <li>
            <strong>{events.length}</strong> event{events.length === 1 ? "" : "s"}
          </li>
          <li>
            <strong>{totalRegistrations}</strong> registration{totalRegistrations === 1 ? "" : "s"}
          </li>
          <li>
            <strong>{pendingPayments}</strong> payment{pendingPayments === 1 ? "" : "s"} to review
          </li>
          <li>
            <strong>{presentTotal}</strong> student{presentTotal === 1 ? "" : "s"} present
          </li>
        </ul>
      </section>
      <section className="admin-attention" aria-labelledby="admin-attention-title">
        <h2 id="admin-attention-title">Needs attention</h2>
        {attention.length === 0 ? (
          <p>
            {events.length === 0
              ? "No events yet. Create your first event below to get started."
              : "Nothing needs attention right now. All payments are reviewed and attendance is marked."}
          </p>
        ) : (
          <ul>
            {attention.map((item) => (
              <li key={item.key}>
                {item.text}{" "}
                {item.action === "review" ? (
                  <button onClick={() => loadRegistrations(item.event)}>Review payments</button>
                ) : (
                  <Link href={item.href}>{item.label}</Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      <h2>Events</h2>
      {events.length === 0 && (
        <p className="empty-state">
          No events yet. <Link href="/admin/events/new">Create your first event</Link> to get started.
        </p>
      )}
      {events.map((event) => (
        <article className="card admin-event-card" key={event.id}>
          <h2>{event.title}</h2>
          <p>
            {formatDate(event.startAt)}
            {event.endAt ? ` - ${formatDate(event.endAt)}` : ""}
          </p>
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
            {selected.feeType === "PAID" ? `, ₹${selected.feeAmount}` : ""}. The site cannot check a
            screenshot automatically.
          </p>
          <label>
            Search name, USN, or email
            <input value={search} onChange={(e) => setSearch(e.target.value)} />
          </label>
          <label>
            Payment type
            <select value={paymentTypeFilter} onChange={(e) => setPaymentTypeFilter(e.target.value)}>
              <option value="">All payments</option>
              <option value="PAID">Paid</option>
              <option value="FREE">Free</option>
            </select>
          </label>
          <label>
            Payment status
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
              <option value="">All statuses</option>
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
              Showing {filteredRegistrations.length} of {counts.total} registrations for this event.
            </p>
          )}
          <label>
            Reason for rejection (required when you reject)
            <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: amount does not match this event" />
          </label>
          <Toast toast={toast} onClose={hideToast} />
          {filteredRegistrations.length === 0 && (
            <p>
              No registrations match. <button onClick={clearFilters}>Clear filters</button>
            </p>
          )}
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
                {filteredRegistrations.map((r) => (
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
                          <button onClick={() => paymentAction(r, "VERIFY")} disabled={busyKey === `${r.id}:VERIFY`}>
                            {busyKey === `${r.id}:VERIFY` ? "Verifying..." : "Verify"}
                          </button>{" "}
                          <button onClick={() => paymentAction(r, "REJECT")} disabled={busyKey === `${r.id}:REJECT`}>
                            {busyKey === `${r.id}:REJECT` ? "Rejecting..." : "Reject"}
                          </button>
                        </>
                      )}
                      {(r.paymentStatus === "VERIFIED" || r.paymentStatus === "REJECTED") && (
                        <button onClick={() => resendPaymentMail(r)} disabled={busyKey === `${r.id}:RESEND`}>
                          {busyKey === `${r.id}:RESEND` ? "Sending..." : "Re-send mail"}
                        </button>
                      )}{" "}
                      {r.status === "REGISTERED" && r.attendance !== "PRESENT" && (
                        <button onClick={() => cancelRegistrationAdmin(r)} disabled={busyKey === `${r.id}:CANCEL`}>
                          {busyKey === `${r.id}:CANCEL` ? "Cancelling..." : "Cancel"}
                        </button>
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
        <div className="modal" onClick={() => setScreenshot(null)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
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
