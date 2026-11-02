"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Participation() {
  const [registrations, setRegistrations] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/me/registrations")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setRegistrations(j.data.registrations);
        else setError("Please sign in to see your participation.");
      })
      .catch(() => setError("Please sign in to see your participation."));
  }, []);
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
      {registrations.length === 0 && <p>No registrations yet.</p>}
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
        </div>
      ))}
    </div>
  );
}
