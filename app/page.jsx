"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import BrandLogo from "@/components/BrandLogo";
import Skeleton from "@/components/Skeleton";

function formatEventDate(value) {
  if (!value) return "Date to be announced";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date to be announced";
  return new Intl.DateTimeFormat("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function Home() {
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let active = true;

    async function loadEvents() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/events");
        if (!response.ok) {
          throw new Error(`Event request failed with status ${response.status}`);
        }
        const result = await response.json();
        if (!result.ok || !Array.isArray(result.data?.events)) {
          throw new Error("The events API returned an unexpected response.");
        }
        if (active) setEvents(result.data.events);
      } catch (requestError) {
        console.error("Could not load homepage events.", requestError);
        if (active) setError("We couldn't load events right now. Please try again.");
      } finally {
        if (active) setLoading(false);
      }
    }

    loadEvents();
    return () => {
      active = false;
    };
  }, [reloadKey]);

  return (
    <div className="home-page">
      <section className="home-hero" aria-labelledby="home-title">
        <div className="home-hero__copy">
          <p className="home-eyebrow">
            <span className="home-eyebrow__dot" aria-hidden="true" />
            VVCE · CSE (AI &amp; ML) community
          </p>
          <h1 id="home-title">
            Ideas become
            <span> what we build.</span>
          </h1>
          <p className="home-hero__description">
            Vector Flow is where curious minds come together to explore technology,
            learn by doing, and create what comes next.
          </p>
          <div className="home-hero__actions">
            <a className="home-button home-button--primary" href="#upcoming-events">
              Explore events <span aria-hidden="true">↓</span>
            </a>
            <Link className="home-button home-button--secondary" href="/team">
              Meet the team <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="home-hero__note">
            <span aria-hidden="true">✦</span>
            Learn together. Build boldly. Share what you know.
          </div>
        </div>

        <div className="home-hero__visual">
          <div className="home-hero__logo-frame">
            <BrandLogo className="home-hero__logo" priority />
          </div>
        </div>
      </section>

      <section className="home-events" id="upcoming-events" aria-labelledby="events-title">
        <div className="home-section-heading">
          <div>
            <p className="home-section-kicker">What’s happening</p>
            <h2 id="events-title">Upcoming events</h2>
            <p className="home-section-description">
              Find your next opportunity to learn, connect, and make something.
            </p>
          </div>
          <span className="home-section-mark" aria-hidden="true">01 / EVENTS</span>
        </div>

        {loading ? (
          <div className="home-event-grid" aria-label="Loading events" aria-busy="true">
            <Skeleton variant="card" count={3} />
          </div>
        ) : error ? (
          <div className="home-events-message home-events-message--error" role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </button>
          </div>
        ) : events.length === 0 ? (
          <div className="home-events-message">
            <span className="home-empty-icon" aria-hidden="true">✦</span>
            <h3>Good things are in the works.</h3>
            <p>No upcoming events yet. Check back soon for what’s next.</p>
          </div>
        ) : (
          <div className="home-event-grid">
            {events.map((event) => (
              <article className="home-event-card" key={event.id}>
                <Link
                  className="home-event-card__visual"
                  href={`/events/${event.slug}`}
                  aria-label={`View ${event.title}`}
                >
                  {event.posterImageUrl ? (
                    <img src={event.posterImageUrl} alt="" />
                  ) : (
                    <div className="home-event-card__placeholder" aria-hidden="true">
                      <span>VECTOR FLOW</span>
                      <span>EVENT</span>
                    </div>
                  )}
                  <span className="home-event-card__format">
                    {event.mode === "ONLINE" ? "Online" : event.venue || "VVCE"}
                  </span>
                </Link>
                <div className="home-event-card__content">
                  <div className="home-event-card__meta">
                    <span className="home-event-card__date">{formatEventDate(event.startAt)}</span>
                    <span className="home-event-card__fee">
                      {event.feeType === "PAID"
                        ? event.feeAmount != null
                          ? `₹${event.feeAmount}`
                          : "Paid"
                        : "Free"}
                    </span>
                  </div>
                  <h3>
                    <Link href={`/events/${event.slug}`}>{event.title}</Link>
                  </h3>
                  <p className="home-event-card__description">{event.description}</p>
                  <Link className="home-event-card__link" href={`/events/${event.slug}`}>
                    Explore event <span aria-hidden="true">→</span>
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="home-about" aria-labelledby="about-title">
        <div className="home-about__intro">
          <p className="home-section-kicker">A place to grow</p>
          <h2 id="about-title">Technology is better when we build it together.</h2>
        </div>
        <div className="home-about__body">
          <p>
            Vector Flow is the CSE (AI &amp; ML) club at VVCE Mysore. We bring
            students together around curiosity, practical learning, and the
            excitement of turning ideas into real projects.
          </p>
          <Link className="home-text-link" href="/team">
            Get to know our community <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <section className="home-highlights" aria-label="What makes our community">
        <article className="home-highlight">
          <span className="home-highlight__number">01</span>
          <div>
            <h3>Learn by exploring</h3>
            <p>Make space for questions, new ideas, and learning beyond the classroom.</p>
          </div>
        </article>
        <article className="home-highlight">
          <span className="home-highlight__number">02</span>
          <div>
            <h3>Build with purpose</h3>
            <p>Turn concepts into hands-on experiments, projects, and shared progress.</p>
          </div>
        </article>
        <article className="home-highlight">
          <span className="home-highlight__number">03</span>
          <div>
            <h3>Grow as a community</h3>
            <p>Connect with people who are excited to create, contribute, and improve.</p>
          </div>
        </article>
      </section>

    </div>
  );
}
