"use client";

import { useEffect, useState } from "react";
import FileUpload from "@/components/FileUpload";
import Skeleton from "@/components/Skeleton";

// Sprint 5 Team admin. The admin can add, edit, remove, and
// reorder members, upload a photo, pick an academic year, copy
// last year as a draft, preview a draft, and publish a year.
// Hard rule, shown on the page: publishing a year makes that year
// the live team, and the previous live year becomes History. It
// is never deleted. Preparing a draft never changes the live
// team until you press Publish.
export default function TeamAdmin() {
  const [members, setMembers] = useState([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", designation: "", photoUrl: "", bio: "", orderIndex: "", academicYear: "" });
  const [editing, setEditing] = useState(null);
  const [draftYear, setDraftYear] = useState("");
  const [copyFrom, setCopyFrom] = useState("");
  const [copyTo, setCopyTo] = useState("");
  const [copyError, setCopyError] = useState("");
  const [preview, setPreview] = useState(null);
  // M9: in-flight guards. `saving` covers the add/edit form submit;
  // `busyKey` covers one row or year action at a time, matching the
  // busy-key pattern on the admin dashboard page.
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState(null);

  function load() {
    fetch("/api/admin/team")
      .then((r) =>
        r
          .json()
          .catch(() => null)
          .then((j) => ({ status: r.status, json: j }))
      )
      .then(({ status, json }) => {
        setLoading(false);
        // m19: only a genuine 401/403 is an access error. Any other
        // failure is a load problem, not a permissions problem.
        if (json && json.ok) setMembers(json.data.members);
        else if (status === 401 || status === 403) setError("Team admin is for admins only.");
        else setError("Could not load the team. Check your connection and try again.");
      })
      .catch(() => {
        setLoading(false);
        setError("Could not load the team. Check your connection and try again.");
      });
  }

  useEffect(() => {
    load();
  }, []);

  function set(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveMember(e) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setMessage("");
    try {
      const payload = { ...form, orderIndex: form.orderIndex ? Number(form.orderIndex) : 0 };
      const url = editing ? `/api/admin/team/${editing}` : "/api/admin/team";
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not save that member. Name, designation, and academic year are required.");
        return;
      }
      setMessage(editing ? "Member updated." : "Member added as a draft. It will not show as live until its year is published.");
      setForm({ name: "", designation: "", photoUrl: "", bio: "", orderIndex: "", academicYear: "" });
      setEditing(null);
      load();
    } catch {
      setMessage("Could not save that member. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  function editMember(m) {
    setEditing(m.id);
    setForm({
      name: m.name || "",
      designation: m.designation || "",
      photoUrl: m.photoUrl || "",
      bio: m.bio || "",
      orderIndex: m.orderIndex ? String(m.orderIndex) : "",
      academicYear: m.academicYear || "",
    });
  }

  async function removeMember(id) {
    if (!window.confirm("Remove this team member? This only removes this one row.")) return;
    const key = `remove:${id}`;
    if (busyKey === key) return;
    setBusyKey(key);
    try {
      const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
      const json = await res.json();
      setMessage(json.ok ? "Member removed." : "Could not remove that member.");
      load();
    } catch {
      setMessage("Could not remove that member.");
    } finally {
      setBusyKey(null);
    }
  }

  async function move(member, direction) {
    const yearMembers = members.filter((m) => m.academicYear === member.academicYear);
    const sorted = [...yearMembers].sort((a, b) => a.orderIndex - b.orderIndex);
    const index = sorted.findIndex((m) => m.id === member.id);
    const swapWith = direction === "up" ? sorted[index - 1] : sorted[index + 1];
    if (!swapWith) return;
    const orders = [
      { id: member.id, orderIndex: swapWith.orderIndex },
      { id: swapWith.id, orderIndex: member.orderIndex },
    ];
    // m38: a failed reorder used to reload silently either way.
    // The admin now sees when it did not save.
    const key = `move:${member.id}:${direction}`;
    if (busyKey === key) return;
    setBusyKey(key);
    try {
      const res = await fetch("/api/admin/team/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orders }),
      });
      const json = await res.json().catch(() => null);
      if (!json || !json.ok) {
        setMessage("Could not reorder the team. Please try again.");
        return;
      }
      load();
    } catch {
      setMessage("Could not reorder the team. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function copyLastYear() {
    setMessage("");
    // m37: both years are required before the copy is posted, so a
    // blank copy is refused on the page instead of by the server.
    if (!copyFrom.trim() || !copyTo.trim()) {
      setCopyError("Choose both years first: the year to copy from and the new year to copy to.");
      setMessage("Choose both years first: the year to copy from and the new year to copy to.");
      return;
    }
    setCopyError("");
    if (busyKey === "copy") return;
    setBusyKey("copy");
    try {
      const res = await fetch("/api/admin/team/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromYear: copyFrom, toYear: copyTo }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not copy that year. Check that the new year is empty and the old year exists.");
        return;
      }
      setMessage(`Copied ${json.data.copied} members from ${copyFrom} to ${copyTo} as a draft. The live team has not changed.`);
      load();
    } catch {
      setMessage("Could not copy that year. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  async function previewYear() {
    if (busyKey === "preview") return;
    setBusyKey("preview");
    try {
      const res = await fetch(`/api/admin/team/preview?year=${encodeURIComponent(draftYear)}`);
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not preview that year.");
        return;
      }
      setPreview(json.data);
    } catch {
      setMessage("Could not preview that year.");
    } finally {
      setBusyKey(null);
    }
  }

  async function publishYear() {
    if (!window.confirm(`Publish ${draftYear} as the live team? The previous live team will become History, not deleted.`)) return;
    if (busyKey === "publish") return;
    setBusyKey("publish");
    try {
      const res = await fetch("/api/admin/team/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academicYear: draftYear }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not publish that year. It may have no members yet.");
        return;
      }
      setMessage(`Published ${json.data.publishedYear}. Previous live year was ${json.data.previousYear || "none"}. The old team is now in History.`);
      setPreview(null);
      load();
    } catch {
      setMessage("Could not publish that year. Please try again.");
    } finally {
      setBusyKey(null);
    }
  }

  const years = [...new Set(members.map((m) => m.academicYear))].sort().reverse();
  const liveYear = members.find((m) => m.isCurrentYear)?.academicYear || "none";
  // m26: first/last row within each year, so the Up button on the
  // first row and the Down button on the last row are disabled
  // instead of enabled but doing nothing.
  const yearEnds = {};
  years.forEach((y) => {
    const sorted = members
      .filter((m) => m.academicYear === y)
      .sort((a, b) => a.orderIndex - b.orderIndex);
    sorted.forEach((m, i) => {
      yearEnds[m.id] = { isFirst: i === 0, isLast: i === sorted.length - 1 };
    });
  });

  if (loading)
    return (
      <div className="admin-content-page team-admin-page" aria-label="Loading team" aria-busy="true">
        <Skeleton variant="row" count={3} />
      </div>
    );
  if (error)
    return (
      <div className="admin-content-page team-admin-page">
        <h1>Team admin</h1>
        <p className="error">{error}</p>
        <p>
          <button type="button" onClick={() => window.location.reload()}>
            Try again
          </button>
        </p>
      </div>
    );
  return (
    <div className="admin-content-page team-admin-page">
      <h1>Team admin</h1>
      <p>Live team year now: {liveYear}. Preparing a draft never changes the live team until you press Publish.</p>
      {message && <p className="status-message" role="status">{message}</p>}
      <h2>{editing ? "Edit member" : "Add member"}</h2>
      <form className="team-admin-form" onSubmit={saveMember}>
        <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
        <label>Designation<input value={form.designation} onChange={(e) => set("designation", e.target.value)} required /></label>
        <FileUpload folder="vector-flow/team" label="Photo" onUploaded={(url) => set("photoUrl", url)} />
        {form.photoUrl && (
          <p>
            Photo: {form.photoUrl}
            <br />
            <img src={form.photoUrl} alt="Team photo preview" style={{ maxWidth: "96px", marginTop: "8px" }} />
          </p>
        )}
        <label>About (optional)<textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} /></label>
        <label>Order number<input type="number" value={form.orderIndex} onChange={(e) => set("orderIndex", e.target.value)} /></label>
        <label>Academic year, for example 2026-27<input value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} required /></label>
        <button type="submit" disabled={saving}>{saving ? "Saving..." : editing ? "Update member" : "Add member"}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: "", designation: "", photoUrl: "", bio: "", orderIndex: "", academicYear: "" }); }}>Cancel edit</button>}
      </form>
      <h2>Copy last year as a draft</h2>
      <label>From year<input value={copyFrom} onChange={(e) => { setCopyFrom(e.target.value); setCopyError(""); }} placeholder="2025-26" /></label>
      <label>To new year<input value={copyTo} onChange={(e) => { setCopyTo(e.target.value); setCopyError(""); }} placeholder="2026-27" /></label>
      {copyError && <p className="field-error" role="alert">{copyError}</p>}
      <p><button onClick={copyLastYear} disabled={busyKey === "copy"}>{busyKey === "copy" ? "Copying..." : "Copy last year"}</button></p>
      <h2>Preview and publish</h2>
      <label>
        Year to preview or publish
        <select value={draftYear} onChange={(e) => setDraftYear(e.target.value)}>
          <option value="">Choose a year</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </label>
      <p>
        <button onClick={previewYear} disabled={!draftYear || busyKey === "preview"}>{busyKey === "preview" ? "Previewing..." : "Preview"}</button>{" "}
        <button onClick={publishYear} disabled={!draftYear || busyKey === "publish"}>{busyKey === "publish" ? "Publishing..." : "Publish this year"}</button>
      </p>
      {preview && (
        <div className="card team-admin-preview">
          <h3>Preview for {preview.year}</h3>
          <p>Live year now: {preview.liveYear || "none"}. Publishing {preview.year} will make it live and move the old live team to History.</p>
          {preview.draft.length === 0 && <p>No members in this draft year yet.</p>}
          {preview.draft.map((m) => (
            <p key={m.id}>{m.orderIndex}. {m.name} - {m.designation}</p>
          ))}
        </div>
      )}
      <h2>All members</h2>
      {members.length === 0 && <p>No team members yet.</p>}
      <div className="table-wrap">
        <table>
          <thead>
            <tr><th>Name</th><th>Designation</th><th>Year</th><th>Live</th><th>Order</th><th>Actions</th></tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id}>
                <td>{m.name}</td>
                <td>{m.designation}</td>
                <td>{m.academicYear}</td>
                <td>{m.isCurrentYear ? "Live" : "Draft or History"}</td>
                <td>{m.orderIndex}</td>
                <td>
                  <button onClick={() => editMember(m)}>Edit</button>{" "}
                  <button onClick={() => move(m, "up")} disabled={busyKey === `move:${m.id}:up` || yearEnds[m.id]?.isFirst}>Up</button>{" "}
                  <button onClick={() => move(m, "down")} disabled={busyKey === `move:${m.id}:down` || yearEnds[m.id]?.isLast}>Down</button>{" "}
                  <button onClick={() => removeMember(m.id)} disabled={busyKey === `remove:${m.id}`}>{busyKey === `remove:${m.id}` ? "Removing..." : "Remove"}</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
