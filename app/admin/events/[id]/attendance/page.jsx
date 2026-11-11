"use client";

import { useEffect, useState } from "react";
import Skeleton from "@/components/Skeleton";

// Sprint 3 attendance page. The admin picks Present, Absent, or
// Unmarked for each registration, then presses Save all once.
// Before saving, the page shows a warning count in plain words:
// how many Present, how many Absent, and how many are still
// unmarked, based on the choices on screen right now. A cancelled
// registration is shown but cannot be marked Present; the server
// refuses that too, so the page and the server agree.
export default function Attendance({ params }) {
  const [event, setEvent] = useState(null);
  const [marks, setMarks] = useState({});
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/admin/events/${params.id}/attendance`)
      .then((r) =>
        r
          .json()
          .catch(() => null)
          .then((j) => ({ status: r.status, json: j }))
      )
      .then(({ status, json }) => {
        // m19: only a genuine 401/403 is an access error. A 404 is
        // a missing event; anything else is a load problem.
        if (json && json.ok) {
          const initial = {};
          json.data.registrations.forEach((r) => {
            initial[r.id] = r.attendance;
          });
          setMarks(initial);
          setEvent({ ...json.data.event, registrations: json.data.registrations });
        } else if (status === 401 || status === 403) {
          setError("Attendance is for admins only. Please sign in as an admin.");
        } else if (status === 404) {
          setError("This event was not found.");
        } else {
          setError("Could not load attendance. Check your connection and try again.");
        }
      })
      .catch(() => setError("Could not load attendance. Check your connection and try again."));
  }, [params.id]);

  function setMark(id, value) {
    setMarks((m) => ({ ...m, [id]: value }));
  }

  const registrations = (event && event.registrations) || [];
  const present = registrations.filter((r) => marks[r.id] === "PRESENT").length;
  const absent = registrations.filter((r) => marks[r.id] === "ABSENT").length;
  const unmarked = registrations.filter((r) => marks[r.id] === "UNMARKED" || !marks[r.id]).length;

  async function saveAll() {
    setSaving(true);
    setMessage("");
    try {
      const list = registrations.map((r) => ({ registrationId: r.id, attendance: marks[r.id] || "UNMARKED" }));
      const res = await fetch(`/api/admin/events/${params.id}/attendance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ marks: list }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not save attendance. Please try again.");
        return;
      }
      setMessage(
        `Saved ${json.data.saved} rows.` +
          (json.data.refused && json.data.refused.length > 0
            ? ` ${json.data.refused.length} rows were refused, because a cancelled registration cannot be marked Present.`
            : "")
      );
    } catch {
      setMessage("Could not save attendance. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  if (error)
    return (
      <div className="admin-content-page attendance-page">
        <h1>Attendance</h1>
        <p className="error">{error}</p>
        <p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
      </div>
    );
  if (!event) {
    return (
      <div className="admin-content-page attendance-page">
        <h1>Attendance</h1>
        <div aria-label="Loading attendance">
          <Skeleton variant="row" count={3} />
        </div>
      </div>
    );
  }
  return (
    <div className="admin-content-page attendance-page">
      <h1>Attendance for {event.title}</h1>
      <p className="attendance-summary">
        You marked {present} Present, {absent} Absent, {unmarked} unmarked.
        {unmarked > 0 ? " Please check the unmarked rows before you save." : ""}
      </p>
      {registrations.length === 0 && <p>No registrations yet.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>USN</th>
              <th>Status</th>
              <th>Attendance</th>
            </tr>
          </thead>
          <tbody>
            {registrations.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.usn}</td>
                <td>{r.status}</td>
                <td>
                  <select
                    value={marks[r.id] || "UNMARKED"}
                    onChange={(e) => setMark(r.id, e.target.value)}
                    disabled={r.status !== "REGISTERED" && marks[r.id] !== "PRESENT"}
                  >
                    <option value="UNMARKED">Unmarked</option>
                    <option value="PRESENT" disabled={r.status !== "REGISTERED"}>
                      Present
                    </option>
                    <option value="ABSENT">Absent</option>
                  </select>
                  {r.status !== "REGISTERED" && <span> Cancelled registrations cannot be Present.</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p>
        <button onClick={saveAll} disabled={saving}>
          {saving ? "Saving..." : "Save all"}
        </button>
      </p>
      {message && <p>{message}</p>}
    </div>
  );
}
