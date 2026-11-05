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
      <article className="card gallery-card" key={event.id}>
        {event.posterImageUrl ? (
          <div className="gallery-card__image">
            <img src={event.posterImageUrl} alt={`${event.title} event`} />
          </div>
        ) : (
          <div className="gallery-card__image gallery-card__image--empty" aria-hidden="true">
            <span>Vector Flow</span>
          </div>
        )}
        <div className="gallery-card__content">
          <h3>{event.title}</h3>
          <p className="gallery-card__meta">
            {event.startAt && new Date(event.startAt).toLocaleString()}
            {event.venue ? ` · ${event.venue}` : ""}
          </p>
          <p className="gallery-card__description">{event.description}</p>
          {event.driveLink ? (
            <a href={event.driveLink} target="_blank" rel="noreferrer">
              View photos and files <span aria-hidden="true">→</span>
            </a>
          ) : (
            <p className="gallery-card__unavailable">Photos and files are not linked yet for this event.</p>
          )}
        </div>
      </article>
    );
  }

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;
  return (
    <div className="content-page gallery-page">
      <header className="page-heading">
        <p className="page-eyebrow">From our community</p>
        <h1>Gallery</h1>
        <p>Highlights and moments from Vector Flow events at VVCE.</p>
      </header>
      <section className="gallery-section" aria-labelledby="gallery-upcoming-title">
        <h2 id="gallery-upcoming-title">Upcoming events</h2>
        {data.upcoming.length === 0 ? (
          <p className="empty-state">No upcoming events yet.</p>
        ) : (
          <div className="gallery-grid">{data.upcoming.map(card)}</div>
        )}
      </section>
      <section className="gallery-section" aria-labelledby="gallery-history-title">
        <h2 id="gallery-history-title">History</h2>
        {data.history.length === 0 ? (
          <p className="empty-state">No past events yet.</p>
        ) : (
          <div className="gallery-grid">{data.history.map(card)}</div>
        )}
      </section>
    </div>
  );
}
