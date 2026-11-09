"use client";

import { useEffect, useState } from "react";

// Sprint 5 Team page, public. Shows the current year team by
// default, ordered as the admin set it. The year selector shows
// past years, which are History and are never changed by
// publishing a new year. A member with no photo shows no image,
// instead of a broken image.
export default function Team() {
  const [data, setData] = useState(null);
  const [year, setYear] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  function load(selectedYear) {
    setLoading(true);
    setError("");
    const query = selectedYear ? `?year=${encodeURIComponent(selectedYear)}` : "";
    fetch(`/api/team${query}`)
      .then((r) => r.json())
      .then((j) => {
        setLoading(false);
        if (j.ok) {
          setData(j.data);
          setYear(j.data.year);
        } else setError("Could not load the team.");
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load the team.");
      });
  }

  useEffect(() => {
    load("");
  }, []);

  if (loading) return <p>Loading...</p>;
  // m35: a failed load gets a Try again button, like the homepage
  // already has, instead of plain error text with no way forward.
  if (error)
    return (
      <div className="content-page team-page">
        <p className="error">{error}</p>
        <p>
          <button type="button" onClick={() => load(year)}>
            Try again
          </button>
        </p>
      </div>
    );
  return (
    <div className="content-page team-page">
      <header className="page-heading page-heading--split">
        <div>
          <p className="page-eyebrow">The people behind the club</p>
          <h1>Our team</h1>
          <p>Meet the students who make Vector Flow happen.</p>
        </div>
        {data.years.length > 0 && (
          <label className="team-year-control">
            Year
            <select value={year} onChange={(e) => load(e.target.value)}>
              {data.years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>
      <p className="team-page__year">Showing team for {data.year || "no year yet"}.</p>
      {data.members.length === 0 ? (
        <p className="empty-state">No team members listed for this year yet.</p>
      ) : (
        <div className="team-grid">
          {data.members.map((m) => (
            <article className="card team-card" key={m.id}>
              {m.photoUrl ? (
                <img className="team-card__photo" src={m.photoUrl} alt={m.name} />
              ) : (
                <div className="team-card__photo team-card__photo--empty" aria-hidden="true">
                  {m.name.split(/\s+/).map((part) => part[0]).join("").slice(0, 2)}
                </div>
              )}
              <div>
                <h2>{m.name}</h2>
                <p className="team-card__designation">{m.designation}</p>
                {m.bio && <p className="team-card__bio">{m.bio}</p>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
