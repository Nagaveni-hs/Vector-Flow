"use client";

import { useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;

export default function FileUpload({ folder, onUploaded, label }) {
  const [message, setMessage] = useState("");
  async function onChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage("File is too large. Maximum is 5 MB.");
      return;
    }
    setMessage("Uploading...");
    try {
      const sigRes = await fetch("/api/upload/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folder }),
      });
      const sig = await sigRes.json();
      if (!sig.ok) {
        setMessage("Upload is not allowed. Please sign in again.");
        return;
      }
      const form = new FormData();
      form.append("file", file);
      form.append("api_key", sig.data.apiKey);
      form.append("timestamp", String(sig.data.timestamp));
      form.append("signature", sig.data.signature);
      form.append("folder", sig.data.folder);
      const up = await fetch(
        `https://api.cloudinary.com/v1_1/${sig.data.cloudName}/image/upload`,
        { method: "POST", body: form }
      );
      const upJson = await up.json();
      if (!up.ok || !upJson.secure_url) {
        setMessage("Upload failed. Please try again.");
        return;
      }
      setMessage("Uploaded.");
      onUploaded(upJson.secure_url);
    } catch {
      setMessage("Upload failed. Please try again.");
    }
  }
  return (
    <div>
      <label>
        {label || "Upload image"}
        <input type="file" accept="image/*" onChange={onChange} />
      </label>
      {message && <p>{message}</p>}
    </div>
  );
}
