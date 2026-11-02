"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FileUpload from "@/components/FileUpload";

// Sprint 3 and 4 changes to Participation, surgical only:
// 1. If a payment was rejected, the student sees the reason and can
//    upload a new screenshot here, which sends the payment back for
//    review. No other registration field can be changed here.
// 2. A certificate download button appears only after a certificate
//    has been sent. Uploaded, held, queued, or failed certificates
//    show no download button at all, because the server also hides
//    them from this page's data.
export default function Participation() {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  function load() {
    fetch("/api/me/registrations")
      .then((r) => r.json())
      .then((j) => {
        setLoading(false);
        if (j.ok) setRegistrations(j.data.registrations);
        else setError("Please sign in to see your participation.");
      })
      .catch(() => {
        setLoading(false);
        setError("Please sign in to see your participation.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  async function reupload(registration, url) {
    setMessage("");
    const res = await fetch(`/api/registrations/${registration.id}/reupload`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentScreenshotUrl: url }),
    });
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not upload that screenshot. Please try again.");
      return;
    }
    setMessage("New screenshot uploaded. Your payment is back under review.");
    load();
  }

  async function downloadCertificate(registration) {
    setMessage("");
    const res = await fetch(`/api/certificates/${registration.certificate.id}/download`);
    const json = await res.json();
    if (!json.ok) {
      setMessage("Certificate download is not available yet.");
      return;
    }
    window.open(json.data.downloadUrl, "_blank");
  }

  if (loading) return <p>Loading...</p>;
  if (error) {
    return (
      <div>
        <h1>Participation</h1>
        <p>{error}</p>
        <Link href="/signin">Sign in</Link>
      </div>
    );
  }
  return (
    <div>
      <h1>Participation</h1>
      {message && <p>{message}</p>}
      {registrations.length === 0 && <p>No registrations yet.</p>}
      {registrations.length === 0 && <p>No certificates yet.</p>}
      {registrations.map((r) => (
        <div className="card" key={r.id}>
          <h2>
            <Link href={`/events/${r.event.slug}`}>{r.event.title}</Link>
          </h2>
          <p>
            {r.event.startAt && new Date(r.event.startAt).toLocaleString()} -{" "}
            {r.event.feeType === "PAID" ? `Rs ${r.event.feeAmount}` : "Free"}
          </p>
          <p>Payment: {r.paymentStatus} - Attendance: {r.attendance} - Status: {r.status}</p>
          {r.paymentStatus === "REJECTED" && (
            <div>
              <p>Your payment was rejected. Reason: {r.rejectionReason || "No reason was given."}</p>
              <p>Please upload a new payment screenshot. Check the receiver and amount on the event page first.</p>
              <FileUpload folder="vector-flow/screenshots" label="Upload new payment screenshot" onUploaded={(url) => reupload(r, url)} />
            </div>
          )}
          {r.certificate && r.certificate.status === "SENT" && (
            <p>
              <button onClick={() => downloadCertificate(r)}>Download certificate</button>
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
