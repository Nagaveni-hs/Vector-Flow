"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import FileUpload from "@/components/FileUpload";
import Skeleton from "@/components/Skeleton";
import Toast, { useToast } from "@/components/Toast";

function formatEventDate(value) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be announced";
  // m25: event times are shown in IST, like the mail does, not in
  // whatever timezone the visitor's browser happens to be in.
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Participation() {
  const [user, setUser] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState("");
  // m34: whether the load failed because the reader is not signed
  // in (401) or for another reason. Only the first one gets a
  // Sign-in link; anything else gets a Try again button.
  const [authError, setAuthError] = useState(false);
  const { toast, showToast, hideToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("attended");
  const [viewingCert, setViewingCert] = useState(null);
  const [viewerLoading, setViewerLoading] = useState(false);
  // m28: one in-flight key per cancel / re-upload / download, so a
  // double-click cannot fire the same action twice.
  const [busyKey, setBusyKey] = useState(null);

  function load() {
    setError("");
    setAuthError(false);
    // Load student profile & registrations in parallel
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()).catch(() => null),
      fetch("/api/me/registrations").then(async (r) => ({
        status: r.status,
        json: await r.json().catch(() => null),
      })),
    ])
      .then(([authRes, regRes]) => {
        setLoading(false);
        if (authRes && authRes.ok) {
          setUser(authRes.data.user);
        }
        const regJson = regRes && regRes.json;
        if (regJson && regJson.ok) {
          setRegistrations(regJson.data.registrations);
        } else if (regRes && regRes.status === 401) {
          // m34: only a 401 means "not signed in". Any other
          // failure used to show the same message with no retry.
          setAuthError(true);
          setError("Please sign in to see your participation.");
        } else {
          setError("Could not load your participation. Please try again.");
        }
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load your participation. Please try again.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  // Handle escape key and scroll lock for certificate viewer modal
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape" && viewingCert) {
        setViewingCert(null);
      }
    }
    if (viewingCert) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [viewingCert]);

  async function reupload(registration, url) {
    const key = `reupload:${registration.id}`;
    if (busyKey === key) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/registrations/${registration.id}/reupload`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentScreenshotUrl: url }),
      });
      const json = await res.json();
      if (!json.ok) {
        showToast("Could not upload that screenshot. Please try again.", "error");
        return;
      }
      showToast("New screenshot uploaded. Your payment is back under review.", "success");
      load();
    } catch {
      showToast("Could not upload that screenshot. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function cancelRegistration(registration) {
    const key = `cancel:${registration.id}`;
    if (busyKey === key) return;
    const isPaid = registration.event?.feeType === "PAID";
    const note = isPaid
      ? " Cancelling does not refund the money automatically -- payment was manual UPI, so ask the club admin for a refund by hand."
      : "";
    if (!window.confirm(`Cancel your registration for ${registration.event?.title || "this event"}?${note}`)) {
      return;
    }
    setBusyKey(key);
    try {
      const res = await fetch(`/api/registrations/${registration.id}/cancel`, {
        method: "POST",
      });
      const json = await res.json();
      if (!json.ok) {
        if (json.error === "ALREADY_CANCELLED") {
          // m28: a second cancel landing after our own success must
          // not show an "already cancelled" error toast. Mark the
          // row cancelled locally and stay quiet.
          setRegistrations((list) =>
            list.map((r) => (r.id === registration.id ? { ...r, status: "CANCELLED" } : r))
          );
          return;
        }
        if (json.error === "CANNOT_CANCEL_ATTENDED") showToast("You cannot cancel after attendance was marked Present.", "error");
        else if (json.error === "REGISTRATION_CLOSED") showToast("You cannot cancel after the event has started.", "error");
        else showToast("Could not cancel that registration. Please try again.", "error");
        return;
      }
      // Mark the row cancelled at once, so the Cancel button
      // disappears immediately instead of waiting for the reload.
      setRegistrations((list) =>
        list.map((r) =>
          r.id === registration.id ? { ...r, status: "CANCELLED", cancelledAt: new Date().toISOString() } : r
        )
      );
      showToast(
        json.data?.paidRefundNote
          ? `Registration cancelled. ${json.data.paidRefundNote}`
          : "Registration cancelled. You can register again for this event later if you change your mind.",
        "success"
      );
      load();
    } catch {
      showToast("Could not cancel that registration. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  function isCancellable(registration) {
    if (registration.status !== "REGISTERED") return false;
    if (registration.attendance === "PRESENT") return false;
    if (!registration.event?.startAt) return false;
    return new Date(registration.event.startAt) > new Date();
  }

  async function downloadCertificate(registration) {
    const key = `download:${registration.id}`;
    if (busyKey === key) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/certificates/${registration.certificate.id}/download`);
      const json = await res.json();
      if (!json.ok || !json.data?.downloadUrl) {
        showToast("Certificate download is not available yet.", "error");
        return;
      }
      // Create temporary anchor to initiate direct download
      const a = document.createElement("a");
      a.href = json.data.downloadUrl;
      a.target = "_blank";
      a.rel = "noreferrer";
      a.download = `${(registration.event?.title || "Event").replace(/[^a-zA-Z0-9_-]/g, "_")}_Certificate.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      showToast("Could not download the certificate right now. Please try again.", "error");
    } finally {
      setBusyKey(null);
    }
  }

  async function viewCertificate(registration) {
    if (viewerLoading) return;
    setViewerLoading(true);
    setViewingCert({ registration, url: null });
    try {
      const res = await fetch(`/api/certificates/${registration.certificate.id}/download`);
      const json = await res.json();
      if (!json.ok || !json.data?.downloadUrl) {
        showToast("Certificate is not ready for viewing yet.", "error");
        setViewingCert(null);
        return;
      }
      setViewingCert({ registration, url: json.data.downloadUrl });
    } catch {
      showToast("Could not load the certificate viewer. Please try again.", "error");
      setViewingCert(null);
    } finally {
      setViewerLoading(false);
    }
  }

  if (loading)
    return (
      <div className="content-page participation-page" aria-label="Loading participation" aria-busy="true">
        <div className="card">
          <Skeleton variant="text" count={2} />
        </div>
        <Skeleton variant="row" count={1} />
        <section className="participation-stats" aria-hidden="true">
          {[0, 1, 2].map((item) => (
            <div className="participation-stat-card" key={item}>
              <Skeleton variant="text" count={2} />
            </div>
          ))}
        </section>
        <Skeleton variant="row" count={3} />
      </div>
    );

  if (error) {
    return (
      <div className="content-page participation-page">
        <header className="page-heading">
          <p className="page-eyebrow">Your activity</p>
          <h1>Participation</h1>
          <p>{error}</p>
        </header>
        {authError ? (
          <Link className="signin-page__button" href="/signin">Sign in</Link>
        ) : (
          <button type="button" className="signin-page__button" onClick={load}>
            Try again
          </button>
        )}
      </div>
    );
  }

  const attendedRegistrations = registrations.filter((r) => r.attendance === "PRESENT");
  const sentCertificates = registrations.filter((r) => r.certificate && r.certificate.status === "SENT");

  return (
    <div className="content-page participation-page">
      <header className="page-heading">
        <p className="page-eyebrow">Student Dashboard</p>
        <h1>Participation &amp; Certificates</h1>
        <p>Your registrations, verified attendance, and E-Participation Certificates in one place.</p>
      </header>

      <Toast toast={toast} onClose={hideToast} />

      {/* Student Profile Card */}
      {user && (
        <section className="participation-profile-card" aria-label="Student profile summary">
          <div className="participation-profile-card__info">
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <div className="participation-profile-card__tags">
            {user.usn && <span className="participation-tag">USN: {user.usn}</span>}
            {user.branch && <span className="participation-tag">{user.branch}</span>}
            {user.semester && <span className="participation-tag">Sem {user.semester}</span>}
            <span className="participation-tag">{user.role === "ADMIN" ? "Admin" : "Student"}</span>
          </div>
        </section>
      )}

      {/* Participation Metric Summary Stats */}
      <section className="participation-stats" aria-label="Participation summary statistics">
        <div className="participation-stat-card participation-stat-card--teal">
          <div className="participation-stat-card__icon" aria-hidden="true">🎓</div>
          <div>
            <p className="participation-stat-card__value">{attendedRegistrations.length}</p>
            <p className="participation-stat-card__label">Attended Events</p>
          </div>
        </div>

        <div className="participation-stat-card participation-stat-card--purple">
          <div className="participation-stat-card__icon" aria-hidden="true">📜</div>
          <div>
            <p className="participation-stat-card__value">{sentCertificates.length}</p>
            <p className="participation-stat-card__label">E-Certificates Earned</p>
          </div>
        </div>

        <div className="participation-stat-card">
          <div className="participation-stat-card__icon" aria-hidden="true">📋</div>
          <div>
            <p className="participation-stat-card__value">{registrations.length}</p>
            <p className="participation-stat-card__label">Total Registrations</p>
          </div>
        </div>
      </section>

      {/* Global Empty State if student has 0 registrations */}
      {registrations.length === 0 && (
        <div className="empty-state">
          <h2>No registrations yet</h2>
          <p>Events you register for will appear here.</p>
          <p>No certificates yet.</p>
          <Link href="/">Explore upcoming events</Link>
        </div>
      )}

      {registrations.length > 0 && (
        <>
          {/* Navigation View Switcher */}
          <nav className="participation-nav-tabs" aria-label="Participation dashboard views">
            <button
              type="button"
              className={`participation-tab-button${activeTab === "attended" ? " is-active" : ""}`}
              onClick={() => setActiveTab("attended")}
              aria-current={activeTab === "attended" ? "true" : undefined}
            >
              Attended Events &amp; Certificates
              <span className="participation-tab-pill">{attendedRegistrations.length}</span>
            </button>
            <button
              type="button"
              className={`participation-tab-button${activeTab === "all" ? " is-active" : ""}`}
              onClick={() => setActiveTab("all")}
              aria-current={activeTab === "all" ? "true" : undefined}
            >
              All Registrations
              <span className="participation-tab-pill">{registrations.length}</span>
            </button>
          </nav>

          {/* Tab 1: Attended Events Dashboard */}
          {activeTab === "attended" && (
            <div className="participation-section" aria-label="Attended events list">
              {attendedRegistrations.length === 0 ? (
                <div className="empty-state">
                  <h2>No attended events yet</h2>
                  <p>When you attend a Vector Flow event and attendance is recorded, it will be listed here.</p>
                  <p>No certificates yet.</p>
                  <button
                    type="button"
                    className="signin-page__button"
                    onClick={() => setActiveTab("all")}
                    style={{ marginTop: "12px", display: "inline-block" }}
                  >
                    View all registrations ({registrations.length})
                  </button>
                </div>
              ) : (
                <div className="participation-card-list">
                  {attendedRegistrations.map((r) => (
                    <article className="attended-card" key={r.id}>
                      <div className="attended-card__header">
                        <div>
                          <h3>
                            <Link href={`/events/${r.event.slug}`}>{r.event.title}</Link>
                          </h3>
                          <p className="attended-card__meta">
                            <span>📅 {formatEventDate(r.event.startAt)}</span>
                            {r.event.venue && <span>📍 {r.event.venue}</span>}
                            <span>💳 {r.event.feeType === "PAID" ? `₹${r.event.feeAmount}` : "Free"}</span>
                          </p>
                        </div>
                        <span className="attended-badge">
                          <span aria-hidden="true">✓</span> Attended
                        </span>
                      </div>

                      {/* E-Participation Certificate section */}
                      {r.certificate && r.certificate.status === "SENT" ? (
                        <div className="attended-card__certificate-box">
                          <div className="attended-card__certificate-info">
                            <span className="attended-card__certificate-icon" aria-hidden="true">📜</span>
                            <div>
                              <strong>E-Participation Certificate Ready</strong>
                              <span>
                                {r.certificate.emailedAt
                                  ? `Issued on ${new Date(r.certificate.emailedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}`
                                  : "Verified and available"}
                              </span>
                            </div>
                          </div>
                          <div className="attended-card__certificate-actions">
                            <button
                              type="button"
                              className="btn-cert-view"
                              onClick={() => viewCertificate(r)}
                              disabled={viewerLoading}
                              title="View certificate preview"
                            >
                              <span aria-hidden="true">👁️</span> View Certificate
                            </button>
                            <button
                              type="button"
                              className="btn-cert-download"
                              onClick={() => downloadCertificate(r)}
                              disabled={busyKey === `download:${r.id}`}
                              title="Download certificate PDF"
                            >
                              <span aria-hidden="true">⬇</span> Download Certificate
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="attended-card__certificate-pending">
                          <span>⏳ Attendance marked Present · E-Certificate processing and will appear here once published.</span>
                        </div>
                      )}
                    </article>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: All Registrations List */}
          {activeTab === "all" && (
            <div className="participation-section" aria-label="All registered events">
              <div className="participation-card-list">
                {registrations.map((r) => (
                  <article className="card participation-card" key={r.id}>
                    <h2>
                      <Link href={`/events/${r.event.slug}`}>{r.event.title}</Link>
                    </h2>
                    <p className="participation-card__meta">
                      {formatEventDate(r.event.startAt)} -{" "}
                      {r.event.feeType === "PAID" ? `₹${r.event.feeAmount}` : "Free"}
                      {r.event.venue ? ` · ${r.event.venue}` : ""}
                    </p>
                    <div className="participation-card__statuses">
                      <span>Payment <strong>{r.paymentStatus.replaceAll("_", " ")}</strong></span>
                      <span>Attendance <strong>{r.attendance}</strong></span>
                      <span>Status <strong>{r.status}</strong></span>
                    </div>

                    {r.status === "CANCELLED" && (
                      <div className="participation-card__notice">
                        <p>Cancelled{r.cancelledAt ? ` on ${new Date(r.cancelledAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata" })}` : ""}. You can register again for this event from its page, if registration is still open.</p>
                        <Link href={`/events/${r.event.slug}`}>Register again</Link>
                      </div>
                    )}

                    {isCancellable(r) && (
                      <div style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() => cancelRegistration(r)}
                          disabled={busyKey === `cancel:${r.id}`}
                        >
                          {busyKey === `cancel:${r.id}` ? "Cancelling..." : "Cancel registration"}
                        </button>
                        {r.event.feeType === "PAID" && (
                          <p style={{ margin: "6px 0 0" }}>
                            Paid by UPI: cancelling does not refund the money automatically. Ask the club admin for a refund by hand.
                          </p>
                        )}
                      </div>
                    )}

                    {r.paymentStatus === "REJECTED" && (
                      <div className="participation-card__notice">
                        <p>Your payment was rejected. Reason: {r.rejectionReason || "No reason was given."}</p>
                        <p>Please upload a new payment screenshot. Check the receiver and amount on the event page first.</p>
                        <FileUpload
                          folder="vector-flow/screenshots"
                          label="Upload new payment screenshot"
                          onUploaded={(url) => reupload(r, url)}
                        />
                      </div>
                    )}

                    {r.certificate && r.certificate.status === "SENT" && (
                      <div className="attended-card__certificate-actions" style={{ marginTop: "8px" }}>
                        <button
                          type="button"
                          className="btn-cert-view"
                          onClick={() => viewCertificate(r)}
                          disabled={viewerLoading}
                        >
                          <span aria-hidden="true">👁️</span> View Certificate
                        </button>
                        <button
                          type="button"
                          className="btn-cert-download"
                          onClick={() => downloadCertificate(r)}
                          disabled={busyKey === `download:${r.id}`}
                        >
                          <span aria-hidden="true">⬇</span> Download Certificate
                        </button>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* E-Participation Certificate Viewer Modal */}
      {viewingCert && (
        <div
          className="cert-modal-backdrop"
          onClick={() => setViewingCert(null)}
          role="presentation"
        >
          <div
            className="cert-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cert-modal-title"
          >
            <div className="cert-modal__header">
              <div className="cert-modal__header-title">
                <h3 id="cert-modal-title">E-Participation Certificate</h3>
                <p>{viewingCert.registration?.event?.title}</p>
              </div>
              <button
                type="button"
                className="cert-modal__close"
                onClick={() => setViewingCert(null)}
                aria-label="Close certificate viewer"
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>

            <div className="cert-modal__body">
              {viewerLoading ? (
                <div className="cert-modal__loading">
                  <p>Loading certificate viewer...</p>
                </div>
              ) : viewingCert.url ? (
                <iframe
                  src={viewingCert.url}
                  title={`Certificate for ${viewingCert.registration?.event?.title}`}
                  className="cert-modal__frame"
                />
              ) : (
                <div className="cert-modal__loading">
                  <p>Certificate preview could not be loaded.</p>
                </div>
              )}
            </div>

            <div className="cert-modal__footer">
              {viewingCert.url && (
                <>
                  <a
                    href={viewingCert.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-cert-view"
                  >
                    Open in New Tab ↗
                  </a>
                  <button
                    type="button"
                    className="btn-cert-download"
                    onClick={() => downloadCertificate(viewingCert.registration)}
                    disabled={busyKey === `download:${viewingCert.registration.id}`}
                  >
                    Download Certificate
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn-cert-view"
                onClick={() => setViewingCert(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
