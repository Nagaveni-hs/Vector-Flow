"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export default function Admin() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  useEffect(() => {
    fetch("/api/admin/events")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) setEvents(j.data.events);
        else setError("Admin access only. Please sign in as an admin.");
      })
      .catch(() => setError("Admin access only. Please sign in as an admin."));
  }, []);
  async function showRegistrations(event) {
    setSelected(event);
    const res = await fetch(`/api/admin/events/${event.id}/registrations`);
    const json = await res.json();
    if (json.ok) setRegistrations(json.data.registrations);
  }
  if (error) {
    return (
      <div>
        <h1>Admin</h1>
        <p>{error}</p>
      </div>
    );
  }
  return (
    <div>
      <h1>Admin</h1>
      <p>
        <Link href="/admin/events/new">Create a new event</Link>
      </p>
      {events.map((event) => (
        <div className="card" key={event.id}>
          <h2>{event.title}</h2>
          <p>
            {event.status} - {event._count ? event._count.registrations : 0} registrations
          </p>
          <p>
            <Link href={`/admin/events/${event.slug}`}>Edit</Link>{" "}
            <button onClick={() => showRegistrations(event)}>Show registrations</button>
          </p>
        </div>
      ))}
      {selected && (
        <div>
          <h2>Registrations for {selected.title}</h2>
          {registrations.length === 0 && <p>No registrations yet.</p>}
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>USN</th>
                <th>Email</th>
                <th>Payment</th>
                <th>Attendance</th>
              </tr>
            </thead>
            <tbody>
              {registrations.map((r) => (
                <tr key={r.id}>
                  <td>{r.name}</td>
                  <td>{r.usn}</td>
                  <td>{r.email}</td>
                  <td>{r.paymentStatus}</td>
                  <td>{r.attendance}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
