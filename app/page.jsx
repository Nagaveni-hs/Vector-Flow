"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import StatusBadge from "@/components/StatusBadge";

export default function Home() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEvents(j.data.events);
        else setError("Could not load events.");
      })
      .catch(() => setError("Could not load events."));
  }, []);
  return (
    <div>
      <h1>Vector Flow</h1>
      <p>Official website of Vector Flow, the CSE (AI &amp; ML) club at VVCE Mysore.</p>
      <Link href="/">Home</Link>
      {error && <p className="error">{error}</p>}
      {events.length === 0 && !error && <p>No upcoming events yet.</p>}
      {events.map((event) => (
        <div className="card" key={event.id}>
          {event.posterImageUrl && <img src={event.posterImageUrl} alt={event.title} />}
          <h2>
            <Link href={`/events/${event.slug}`}>{event.title}</Link>
          </h2>
          <p>
            <StatusBadge value={event.feeType === "PAID" ? `Rs ${event.feeAmount}` : "Free"} />
            {event.startAt && new Date(event.startAt).toLocaleString()}
            {event.venue ? ` - ${event.venue}` : ""}
          </p>
          <p>{event.description}</p>
          <Link href={`/events/${event.slug}`}>Register</Link>
        </div>
      ))}
    </div>
  );
}
