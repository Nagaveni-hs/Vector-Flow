"use client";

import { useEffect, useState } from "react";
import FileUpload from "@/components/FileUpload";

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
  const [preview, setPreview] = useState(null);

  function load() {
    fetch("/api/admin/team")
      .then((r) => r.json())
      .then((j) => {
        setLoading(false);
        if (j.ok) setMembers(j.data.members);
        else setError("Team admin is for admins only.");
      })
      .catch(() => {
        setLoading(false);
        setError("Team admin is for admins only.");
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
    setMessage("");
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
    const res = await fetch(`/api/admin/team/${id}`, { method: "DELETE" });
    const json = await res.json();
    setMessage(json.ok ? "Member removed." : "Could not remove that member.");
    load();
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
    await fetch("/api/admin/team/reorder", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orders }),
    });
    load();
  }

  async function copyLastYear() {
    setMessage("");
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
  }

  async function previewYear() {
    const res = await fetch(`/api/admin/team/preview?year=${encodeURIComponent(draftYear)}`);
    const json = await res.json();
    if (!json.ok) {
      setMessage("Could not preview that year.");
      return;
    }
    setPreview(json.data);
  }

  async function publishYear() {
    if (!window.confirm(`Publish ${draftYear} as the live team? The previous live team will become History, not deleted.`)) return;
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
  }

  const years = [...new Set(members.map((m) => m.academicYear))].sort().reverse();
  const liveYear = members.find((m) => m.isCurrentYear)?.academicYear || "none";

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="error">{error}</p>;
  return (
    <div>
      <h1>Team admin</h1>
      <p>Live team year now: {liveYear}. Preparing a draft never changes the live team until you press Publish.</p>
      {message && <p>{message}</p>}
      <h2>{editing ? "Edit member" : "Add member"}</h2>
      <form onSubmit={saveMember}>
        <label>Name<input value={form.name} onChange={(e) => set("name", e.target.value)} required /></label>
        <label>Designation<input value={form.designation} onChange={(e) => set("designation", e.target.value)} required /></label>
        <FileUpload folder="vector-flow/team" label="Photo" onUploaded={(url) => set("photoUrl", url)} />
        {form.photoUrl && <p>Photo: {form.photoUrl}</p>}
        <label>About (optional)<textarea value={form.bio} onChange={(e) => set("bio", e.target.value)} /></label>
        <label>Order number<input type="number" value={form.orderIndex} onChange={(e) => set("orderIndex", e.target.value)} /></label>
        <label>Academic year, for example 2026-27<input value={form.academicYear} onChange={(e) => set("academicYear", e.target.value)} required /></label>
        <button type="submit">{editing ? "Update member" : "Add member"}</button>
        {editing && <button type="button" onClick={() => { setEditing(null); setForm({ name: "", designation: "", photoUrl: "", bio: "", orderIndex: "", academicYear: "" }); }}>Cancel edit</button>}
      </form>
      <h2>Copy last year as a draft</h2>
      <label>From year<input value={copyFrom} onChange={(e) => setCopyFrom(e.target.value)} placeholder="2025-26" /></label>
      <label>To new year<input value={copyTo} onChange={(e) => setCopyTo(e.target.value)} placeholder="2026-27" /></label>
      <p><button onClick={copyLastYear}>Copy last year</button></p>
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
        <button onClick={previewYear} disabled={!draftYear}>Preview</button>{" "}
        <button onClick={publishYear} disabled={!draftYear}>Publish this year</button>
      </p>
      {preview && (
        <div className="card">
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
                  <button onClick={() => move(m, "up")}>Up</button>{" "}
                  <button onClick={() => move(m, "down")}>Down</button>{" "}
                  <button onClick={() => removeMember(m.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
