"use client";

import { useEffect, useState } from "react";

// Sprint 5 Gallery. Upcoming events first, then History. Each card
// shows the event poster if there is one, the date and venue, and
// the event's drive link if there is one. If there is no drive
// link, the card says so plainly instead of showing a broken link.
export default function Gallery() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((j) => {
        setLoading(false);
        if (j.ok) setData(j.data);
        else setError("Could not load the gallery.");
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load the gallery.");
      });
  }, []);

  function card(event) {
    return (
      <div className="card" key={event.id}>
        {event.posterImageUrl && <img src={event.posterImageUrl} alt={event.title} />}
        <h2>{event.title}</h2>
        <p>
          {event.startAt && new Date(event.startAt).toLocaleString()}
          {event.venue ? ` - ${event.venue}` : ""}
        </p>
        <p>{event.description}</p>
        {event.driveLink ? (
          <p>
            <a href={event.driveLink} target="_blank" rel="noreferrer">
              View photos and files
            </a>
          </p>
        ) : (
          <p>Photos and files are not linked yet for this event.</p>
        )}
      </div>
    );
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;
  return (
    <div>
      <h1>Gallery</h1>
      <h2>Upcoming events</h2>
      {data.upcoming.length === 0 && <p>No upcoming events yet.</p>}
      {data.upcoming.map(card)}
      <h2>History</h2>
      {data.history.length === 0 && <p>No past events yet.</p>}
      {data.history.map(card)}
    </div>
  );
}
