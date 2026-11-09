import crypto from "crypto";

// m3: the signature now covers what is being uploaded, not just
// where it goes. resource_type, allowed formats, and a max file size
// are tied to the folder: certificates are raw PDFs up to 10 MB,
// everything else is an image up to 5 MB. The signature string
// holds the signed parameters sorted alphabetically, as Cloudinary
// requires (SHA-1 over folder + timestamp is Cloudinary's own
// scheme, not a flaw -- the extra parameters just join that string).
// Note, from Cloudinary's own signature docs: resource_type is
// NEVER part of the string to sign -- it lives in the upload URL
// path (image/upload vs raw/upload), which the components already
// choose per folder -- so it is returned here for the caller to
// use, but not hashed. The signed parameters (allowed_formats,
// max_file_size) must be sent in the upload form with the same
// values, or Cloudinary refuses the upload.
const PRESETS = {
  "vector-flow/certificates": {
    resourceType: "raw",
    allowedFormats: "pdf",
    maxFileSize: 10 * 1024 * 1024,
  },
};

function presetFor(folder) {
  return (
    PRESETS[folder] || {
      resourceType: "image",
      allowedFormats: "jpg,jpeg,png,webp,gif",
      maxFileSize: 5 * 1024 * 1024,
    }
  );
}

export function cloudinarySignature(folder) {
  const secret = process.env.CLOUDINARY_API_SECRET;
  if (!secret) throw new Error("CLOUDINARY_API_SECRET is not set");
  const timestamp = Math.floor(Date.now() / 1000);
  const preset = presetFor(folder);
  const toSign =
    `allowed_formats=${preset.allowedFormats}&folder=${folder}` +
    `&max_file_size=${preset.maxFileSize}&timestamp=${timestamp}${secret}`;
  const signature = crypto.createHash("sha1").update(toSign).digest("hex");
  return {
    timestamp,
    signature,
    apiKey: process.env.CLOUDINARY_API_KEY || "",
    cloudName: process.env.CLOUDINARY_CLOUD_NAME || "",
    folder,
    resourceType: preset.resourceType,
    allowedFormats: preset.allowedFormats,
    maxFileSize: preset.maxFileSize,
  };
}
