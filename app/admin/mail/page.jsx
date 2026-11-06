// Standalone Mail section. Not tied to any event and not tied to a
// slug: the admin types the To list, the subject, and the body here,
// or loads the To list from an Excel / CSV file of registered
// students. Guarded by the admin layout (and the P0 middleware for
// /admin/*), so only admins ever see this page.
"use client";

import { useState } from "react";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Split one CSV line on commas, respecting double-quoted fields.
function parseCsvLine(line) {
  const cells = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          quoted = false;
        }
      } else {
        cell += ch;
      }
    } else if (ch === '"') {
      quoted = true;
    } else if (ch === ",") {
      cells.push(cell);
      cell = "";
    } else {
      cell += ch;
    }
  }
  cells.push(cell);
  return cells;
}

// Rows are arrays of cell strings. The email column is the first
// column whose header contains "email" (Email, College Email, ...),
// case-insensitive. If no header matches, column 0 is used. If the
// first row itself looks like an email address, the file has no
// header row, so row 0 is data too.
function emailsFromRows(rows) {
  const clean = rows
    .map((row) => row.map((cell) => String(cell ?? "").trim()))
    .filter((row) => row.some((cell) => cell !== ""));
  if (clean.length === 0) return { emails: [], skipped: 0 };
  const header = clean[0];
  let col = header.findIndex((cell) => cell.toLowerCase().includes("email"));
  if (col === -1) col = 0;
  let start = 1;
  if (EMAIL_RE.test(header[col] || "")) start = 0;
  const seen = new Set();
  const emails = [];
  let skipped = 0;
  for (let i = start; i < clean.length; i += 1) {
    const value = (clean[i][col] || "").trim().toLowerCase();
    if (!value) continue;
    if (!EMAIL_RE.test(value)) {
      skipped += 1;
      continue;
    }
    if (seen.has(value)) continue;
    seen.add(value);
    emails.push(value);
  }
  return { emails, skipped };
}

function emailsFromCsvText(text) {
  const lines = text.split(/\r\n|\r|\n/).filter((line) => line.trim() !== "");
  return emailsFromRows(lines.map(parseCsvLine));
}

export default function MailPage() {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [fileNote, setFileNote] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  function mergeAddresses(loaded, skipped) {
    const current = to
      .split(/[\n,;]+/)
      .map((v) => v.trim().toLowerCase())
      .filter((v) => v !== "");
    const seen = new Set(current);
    const added = [];
    for (const email of loaded) {
      if (!seen.has(email)) {
        seen.add(email);
        added.push(email);
      }
    }
    setTo([...current, ...added].join(", "));
    setFileNote(
      `${loaded.length} address${loaded.length === 1 ? "" : "es"} loaded from the file` +
        ` (${added.length} new), ${skipped} skipped as invalid.` +
        " Check the To box before sending."
    );
  }

  async function handleFile(e) {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setFileNote("");
    setMessage("");
    try {
      if (/\.csv$/i.test(file.name)) {
        const text = await file.text();
        const { emails, skipped } = emailsFromCsvText(text);
        mergeAddresses(emails, skipped);
        return;
      }
      if (/\.(xlsx|xls)$/i.test(file.name)) {
        // SheetJS is loaded only when an Excel file is actually
        // chosen, so it never weighs down any other page.
        const XLSX = await import("xlsx");
        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: "array" });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
        const { emails, skipped } = emailsFromRows(rows);
        mergeAddresses(emails, skipped);
        return;
      }
      setFileNote("That file type is not supported. Use an .xlsx, .xls, or .csv file.");
    } catch {
      setFileNote("Could not read that file. Check it opens in Excel and try again.");
    }
  }

  async function send(e) {
    e.preventDefault();
    setMessage("");
    const recipients = [...new Set(
      to.split(/[\n,;]+/).map((v) => v.trim().toLowerCase()).filter((v) => v !== "")
    )];
    if (recipients.length === 0) {
      setMessage("Add at least one email address to the To box, or load one from a file first.");
      return;
    }
    if (!subject.trim()) {
      setMessage("Write a subject first.");
      return;
    }
    if (!body.trim()) {
      setMessage("Write the mail body first.");
      return;
    }
    if (!window.confirm(`Send this mail to ${recipients.length} address${recipients.length === 1 ? "" : "es"}?`)) {
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: recipients, subject: subject.trim(), body: body.trim() }),
      });
      const json = await res.json();
      if (!json.ok) {
        setMessage("Could not send the mail. Please try again.");
        return;
      }
      const { sent, failed, total } = json.data;
      setMessage(
        `Done: ${sent} sent, ${failed} failed, out of ${total}.` +
          (failed > 0
            ? " The failed addresses are logged, and mail may have failed because the mail setup is not working yet — check the mail settings."
            : "")
      );
    } catch {
      setMessage("Could not send the mail. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-content-page">
      <h1>Mail</h1>
      <p>
        Send a mail to a list of your own choosing. This is not tied to
        any event: type the addresses, the subject, and the body here,
        or load the addresses from an Excel or CSV file of registered
        students. Each student gets their own mail, so no one sees the
        other addresses.
      </p>
      <form className="team-admin-form" onSubmit={send}>
        <label>
          Upload a list (.xlsx, .xls, or .csv)
          <input type="file" accept=".xlsx,.xls,.csv" onChange={handleFile} />
        </label>
        <p>
          The file&apos;s email column is found by its header: any header
          containing &ldquo;email&rdquo; (Email, College Email, and so on).
          If no header matches, the first column is used. Invalid rows
          are skipped and counted, never sent to.
        </p>
        {fileNote && <p>{fileNote}</p>}
        <label>
          To (one address per line, or separated by commas)
          <textarea value={to} onChange={(e) => setTo(e.target.value)} rows={5} required />
        </label>
        <label>
          Subject
          <input value={subject} onChange={(e) => setSubject(e.target.value)} required />
        </label>
        <label>
          Body
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={10} required />
        </label>
        <button type="submit" disabled={sending}>
          {sending ? "Sending..." : "Send mail"}
        </button>
        {message && <p>{message}</p>}
      </form>
    </div>
  );
}
