"use client";

import { useState } from "react";

const MAX_BYTES = 5 * 1024 * 1024;

// m12 (minors): the `accept` prop is enforced here, not just left
// as a browser hint on the input. The template uploader passes
// "image/png,image/jpeg", and a browser that ignores the input's
// accept list must still be refused with a clear message, instead
// of uploading a WebP that the template route then rejects after a
// successful upload. Callers with no accept, or plain "image/*",
// keep the old image-only check.
function acceptMatches(accept, file) {
  if (!accept || accept.trim() === "image/*") return file.type.startsWith("image/");
  const parts = accept
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return parts.some((part) => {
    if (part.startsWith(".")) return file.name.toLowerCase().endsWith(part);
    if (part.endsWith("/*")) return file.type.startsWith(part.slice(0, -1));
    return file.type.toLowerCase() === part;
  });
}

function acceptedLabels(accept) {
  return accept
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((part) => {
      if (part.startsWith(".")) return part.slice(1).toUpperCase();
      const sub = part.split("/")[1] || part;
      if (sub.toLowerCase() === "jpeg") return "JPG";
      return sub.toUpperCase();
    })
    .join(" or ");
}

export default function FileUpload({ folder, onUploaded, label, accept }) {
  const [message, setMessage] = useState("");
  // M17: the input is disabled while an upload runs, and its value
  // is reset after handling, so picking the same file again after a
  // failed upload fires onChange again instead of doing nothing.
  const [uploading, setUploading] = useState(false);
  async function onChange(e) {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    if (!acceptMatches(accept, file)) {
      setMessage(
        accept && accept.trim() !== "image/*"
          ? `Please choose a ${acceptedLabels(accept)} image.`
          : "Please choose an image file."
      );
      e.target.value = "";
      return;
    }
    if (file.size > MAX_BYTES) {
      setMessage("File is too large. Maximum is 5 MB.");
      e.target.value = "";
      return;
    }
    setMessage("Uploading...");
    setUploading(true);
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
      // m3: these two were part of the signed parameters, so they
      // must be sent with the same values or Cloudinary refuses
      // the upload. They cap the file to the type and size the
      // server allowed for this folder.
      form.append("allowed_formats", sig.data.allowedFormats);
      form.append("max_file_size", String(sig.data.maxFileSize));
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
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }
  return (
    <div>
      <label>
        {label || "Upload image"}
        <input type="file" accept={accept || "image/*"} onChange={onChange} disabled={uploading} />
      </label>
      {message && <p>{uploading && <span className="btn-spinner btn-spinner--dark" aria-hidden="true" />} {message}</p>}
    </div>
  );
}
