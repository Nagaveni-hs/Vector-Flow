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
  if (error) return <p className="error">{error}</p>;
  return (
    <div>
      <h1>Team</h1>
      {data.years.length > 0 && (
        <label>
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
      <p>Showing team for {data.year || "no year yet"}.</p>
      {data.members.length === 0 && <p>No team members listed for this year yet.</p>}
      {data.members.map((m) => (
        <div className="card" key={m.id}>
          {m.photoUrl && <img src={m.photoUrl} alt={m.name} />}
          <h2>{m.name}</h2>
          <p>{m.designation}</p>
          {m.bio && <p>{m.bio}</p>}
        </div>
      ))}
    </div>
  );
}
