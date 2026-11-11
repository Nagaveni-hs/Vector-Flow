"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import FileUpload from "@/components/FileUpload";
import { CERT_FONTS, DEFAULT_CERT_BOX, DEFAULT_CERT_SIZE, certFontById, safeFilename, tidyName } from "@/lib/certNames";
import { generateCertificatePdf, checkPrintedName, pageSizeForAspect, templateTypeFromUrl } from "@/lib/certPdf";
import { uploadFileToCloudinary } from "@/lib/signedUpload";

// Certificate generator. On the certificates page, an admin can
// turn a template image into one PDF per Present student, review
// every name on the template before anything is saved, then save
// them through the normal certificate flow: each PDF is uploaded
// with the existing signed Cloudinary upload and saved with the
// existing POST /api/admin/certificates, so it starts as UPLOADED
// and unticked, exactly like a hand-uploaded PDF. Nothing is ever
// sent from here: sending still happens only when the admin ticks
// rows and presses Send on the page below.
// Names come only from attendance (Present students passed in as
// `registrations`). There is no file import and no matching by
// name: rows are keyed by registration id, so two students with
// the same name stay two separate rows.
// The template setup (steps 1 and 2) does NOT need Present
// students: the template is usually ready before attendance is
// marked, so the admin can upload it, place the name box, pick a
// font and save it at any time. Only step 3, Generate, needs
// Present students, and it says so instead of showing the button
// until attendance is marked.
export default function CertificateGenerator({ eventId, event, registrations, onSaved }) {
  const savedTemplate = (event && event.certTemplate) || null;
  const [draftUrl, setDraftUrl] = useState(savedTemplate ? savedTemplate.url : "");
  const [box, setBox] = useState(savedTemplate ? savedTemplate.box : DEFAULT_CERT_BOX);
  const [fontId, setFontId] = useState(savedTemplate ? savedTemplate.font : CERT_FONTS[0].id);
  const [size, setSize] = useState(savedTemplate ? savedTemplate.size : DEFAULT_CERT_SIZE);
  const [showChangeTemplate, setShowChangeTemplate] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateMessage, setTemplateMessage] = useState("");

  const [rows, setRows] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [generateMessage, setGenerateMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [saveMessage, setSaveMessage] = useState("");

  // Bytes and page size from the last generation, kept so an edited
  // printed name can be re-checked without re-fetching everything.
  const fontBytesRef = useRef(null);
  const pageWidthRef = useRef(842);

  // When the page reloads the event (after a save), pick up the
  // saved template again.
  useEffect(() => {
    if (savedTemplate) {
      setDraftUrl(savedTemplate.url);
      setBox(savedTemplate.box);
      setFontId(savedTemplate.font);
      setSize(savedTemplate.size);
      // The saved template changed, so any generated rows were made
      // with the old template/font: drop them and the cached font
      // bytes rather than saving PDFs in a stale font (M4).
      setRows(null);
      fontBytesRef.current = null;
    }
    // Only the saved template drives this, not the drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedTemplate ? JSON.stringify(savedTemplate) : null]);

  const templateSaved = !!savedTemplate;
  const sampleName = registrations.length > 0 ? tidyName(registrations[0].name) : "Your Name Here";

  async function saveTemplate() {
    if (!draftUrl) {
      setTemplateMessage("Upload a template image first.");
      return;
    }
    setSavingTemplate(true);
    setTemplateMessage("");
    try {
      const res = await fetch(`/api/admin/events/${eventId}/certificate-template`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: draftUrl, font: fontId, box, size }),
      });
      const json = await res.json();
      if (!json.ok) {
        setTemplateMessage("Could not save the template. Please check the image is a JPG or PNG and try again.");
        return;
      }
      setTemplateMessage(
        registrations.length > 0
          ? "Template and placement saved. You can generate certificates now."
          : "Template and placement saved. Mark attendance, then come back here to generate certificates."
      );
      setShowChangeTemplate(false);
      // The saved template changed, so any generated rows were made
      // with the old template/font: drop them and the cached font
      // bytes rather than saving PDFs in a stale font (M4).
      setRows(null);
      fontBytesRef.current = null;
      if (onSaved) onSaved();
    } catch {
      setTemplateMessage("Could not save the template. Please check your connection and try again.");
    } finally {
      setSavingTemplate(false);
    }
  }

  function onTemplateUploaded(url) {
    // A new template may have a different layout, so the old name
    // box is not carried over: it goes back to the middle and the
    // admin places it again before saving.
    setDraftUrl(url);
    setBox(DEFAULT_CERT_BOX);
    setShowChangeTemplate(false);
    setTemplateMessage("New template uploaded. Place the name box on it, then save.");
  }

  async function generate() {
    if (!savedTemplate) return;
    setGenerating(true);
    setGenerateMessage("");
    setSaveMessage("");
    setSavedCount(0);
    try {
      const font = certFontById(savedTemplate.font);
      const [templateRes, fontRes] = await Promise.all([
        fetch(savedTemplate.url),
        fetch(`/fonts/${font.file}`),
      ]);
      if (!templateRes.ok || !fontRes.ok) {
        setGenerateMessage("Could not load the template image or the font. Please try again.");
        return;
      }
      const templateBytes = new Uint8Array(await templateRes.arrayBuffer());
      const fontBytes = new Uint8Array(await fontRes.arrayBuffer());
      const templateType = templateTypeFromUrl(savedTemplate.url);
      if (!templateType) {
        setGenerateMessage("The template must be a JPG or PNG image.");
        return;
      }
      // The PDF page size follows the template's own aspect ratio,
      // so the review preview can scale the name by the same ratio.
      const dims = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = () => reject(new Error("IMAGE_LOAD_FAILED"));
        img.src = savedTemplate.url;
      });
      const pageSize = pageSizeForAspect(dims.w / dims.h);
      pageWidthRef.current = pageSize.width;
      fontBytesRef.current = fontBytes;
      const made = [];
      for (const r of registrations) {
        const printedName = tidyName(r.name);
        const result = await generateCertificatePdf({
          templateBytes,
          templateType,
          fontBytes,
          printedName,
          box: savedTemplate.box,
          size: savedTemplate.size,
          title: `Certificate of Participation - ${printedName}`,
        });
        made.push({
          registrationId: r.id,
          name: r.name,
          usn: r.usn,
          printedName,
          pdfBytes: result.bytes,
          fittedSize: result.fittedSize,
          missingGlyphs: result.missingGlyphs,
          removed: false,
          saveStatus: "",
          saveError: "",
        });
      }
      setRows(made);
      const blocked = made.filter((row) => row.missingGlyphs.length > 0).length;
      setGenerateMessage(
        blocked > 0
          ? `${made.length} certificates prepared, but ${blocked} could not be made with this font. Fix the name or pick another font for those students.`
          : `${made.length} certificates prepared. Check every name below, then save them. Nothing is sent yet.`
      );
    } catch {
      setGenerateMessage("Could not generate the certificates. Please try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function recheckRow(row) {
    // The admin edited a printed name: re-run the glyph check and
    // the shrink for that row only, using the same font and box.
    if (!fontBytesRef.current || !savedTemplate) return;
    const result = await checkPrintedName({
      fontBytes: fontBytesRef.current,
      printedName: row.printedName,
      box: savedTemplate.box,
      size: savedTemplate.size,
      pageWidth: pageWidthRef.current,
    });
    setRows((current) =>
      current.map((r) =>
        r.registrationId === row.registrationId
          ? { ...r, fittedSize: result.fittedSize, missingGlyphs: result.missingGlyphs, pdfBytes: result.missingGlyphs.length > 0 ? null : r.pdfBytes }
          : r
      )
    );
  }

  // Editing a name does not remake its PDF here: the PDF is remade
  // at save time from the printed name on screen, so an edit is
  // never lost by saving a stale file. Rows whose font cannot print
  // the edited name keep no PDF and cannot be saved.
  async function saveRows(rowsToSave) {
    // Never save with stale or missing font bytes: if the template
    // or font changed since these rows were generated, the rows
    // should already have been cleared, but refuse here too rather
    // than regenerating PDFs with a null/wrong font (M4).
    if (!fontBytesRef.current || !savedTemplate) {
      setSaveMessage(
        "The template or font changed since these certificates were generated. Generate them again before saving."
      );
      return;
    }
    setSaving(true);
    setSaveMessage("");
    let done = 0;
    const usedNames = new Set();
    for (const row of rowsToSave) {
      setRows((current) =>
        current.map((r) => (r.registrationId === row.registrationId ? { ...r, saveStatus: "saving", saveError: "" } : r))
      );
      try {
        const fileName = `${safeFilename(row.printedName, usedNames)}.pdf`;
        // Remake the PDF from the printed name as it stands now,
        // so an edit made in the review is what gets saved.
        const templateBytes = new Uint8Array(await (await fetch(savedTemplate.url)).arrayBuffer());
        const made = await generateCertificatePdf({
          templateBytes,
          templateType: templateTypeFromUrl(savedTemplate.url),
          fontBytes: fontBytesRef.current,
          printedName: row.printedName,
          box: savedTemplate.box,
          size: savedTemplate.size,
          title: `Certificate of Participation - ${row.printedName}`,
        });
        if (!made.bytes) throw new Error("GLYPH");
        const file = new File([made.bytes], fileName, { type: "application/pdf" });
        const fileUrl = await uploadFileToCloudinary({
          file,
          fileName,
          folder: "vector-flow/certificates",
          resourceType: "raw",
        });
        const res = await fetch("/api/admin/certificates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ registrationId: row.registrationId, fileUrl, fileName }),
        });
        const json = await res.json();
        if (!json.ok) {
          if (json.error === "CERTIFICATE_ALREADY_SENT") {
            throw new Error("ALREADY_SENT");
          }
          throw new Error("SAVE_FAILED");
        }
        done += 1;
        setSavedCount(done);
        setRows((current) =>
          current.map((r) => (r.registrationId === row.registrationId ? { ...r, saveStatus: "saved" } : r))
        );
      } catch (e) {
        const message =
          e.message === "ALREADY_SENT"
            ? "Already sent — not replaced."
            : e.message === "GLYPH"
              ? "This font cannot print that name."
              : "Could not save this one. You can retry it below.";
        setRows((current) =>
          current.map((r) =>
            r.registrationId === row.registrationId ? { ...r, saveStatus: "failed", saveError: message } : r
          )
        );
      }
    }
    setSaving(false);
    const failed = rowsToSave.length - done;
    setSaveMessage(
      done === rowsToSave.length
        ? `${done} certificate${done === 1 ? "" : "s"} saved. They are unticked below: tick them and press Send when you are ready to mail them.`
        : `${done} saved, ${failed} failed. The failed ones are listed below with a retry.`
    );
    if (done > 0 && onSaved) onSaved();
  }

  async function saveAll() {
    if (!rows) return;
    const included = rows.filter((r) => !r.removed && r.pdfBytes);
    if (included.length === 0) {
      setSaveMessage("There is nothing to save: every row is removed or blocked by the font warning.");
      return;
    }
    await saveRows(included);
  }

  async function retryFailed() {
    if (!rows) return;
    const failed = rows.filter((r) => r.saveStatus === "failed" && !r.removed && r.pdfBytes);
    if (failed.length === 0) return;
    await saveRows(failed);
  }

  const includedCount = rows ? rows.filter((r) => !r.removed && r.pdfBytes).length : 0;
  const failedRows = rows ? rows.filter((r) => r.saveStatus === "failed") : [];
  // The placement editor edits the draft box/font/size, but
  // generate() only reads the saved template. While the draft
  // differs from what is saved, generating would silently use the
  // old placement, so Generate stays disabled until saved (M5).
  const templateDirty =
    templateSaved &&
    (box.x !== savedTemplate.box.x ||
      box.y !== savedTemplate.box.y ||
      box.w !== savedTemplate.box.w ||
      box.h !== savedTemplate.box.h ||
      fontId !== savedTemplate.font ||
      size !== savedTemplate.size);

  return (
    <section className="certgen">
      <h2>Generate certificates</h2>
      <p>
        Make one PDF per Present student from a template image, with each name placed on it. Review every
        name before you save anything, and nothing is sent until you tick it and press Send below.
      </p>

      <h3>1. Template</h3>
      {!templateSaved || showChangeTemplate ? (
        <>
          <FileUpload
            folder="vector-flow/cert-templates"
            label="Upload certificate template (PNG or JPG)"
            accept="image/png,image/jpeg"
            onUploaded={onTemplateUploaded}
          />
          <p>Only JPG and PNG templates work: those are the only image types a PDF can hold.</p>
          {templateSaved && (
            <p>
              <button type="button" onClick={() => setShowChangeTemplate(false)}>
                Keep the current template
              </button>
            </p>
          )}
        </>
      ) : (
        <p>
          Template saved.{" "}
          <button
            type="button"
            onClick={() => {
              setShowChangeTemplate(true);
              setTemplateMessage("");
            }}
          >
            Change template
          </button>
        </p>
      )}

      {draftUrl && (
        <>
          <h3>2. Place the name</h3>
          <p>
            Drag the box to where the name goes on the template, and drag its bottom-right corner to resize
            it. The sample name shows where the real names will land. The position is saved as a fraction of
            the template size, so it works for every student.
          </p>
          <PlacementEditor
            templateUrl={draftUrl}
            box={box}
            onBoxChange={setBox}
            fontId={fontId}
            size={size}
            sampleName={sampleName}
          />          <div className="certgen-controls">
            <fieldset>
              <legend>Font (one for this event)</legend>
              {CERT_FONTS.map((f) => (
                <label key={f.id}>
                  <input
                    type="radio"
                    name="cert-font"
                    value={f.id}
                    checked={fontId === f.id}
                    onChange={() => setFontId(f.id)}
                  />{" "}
                  {f.label}
                </label>
              ))}
            </fieldset>
            <label>
              Name size (points)
              <input
                type="number"
                min="8"
                max="200"
                value={size}
                onChange={(e) => setSize(Number(e.target.value) || DEFAULT_CERT_SIZE)}
              />
            </label>
            <label>
              Box left (% of template)
              <input
                type="number"
                min="0"
                max="95"
                value={Math.round(box.x * 100)}
                onChange={(e) =>
                  setBox((b) => ({ ...b, x: Math.min(1 - b.w, Math.max(0, (Number(e.target.value) || 0) / 100)) }))
                }
              />
            </label>
            <label>
              Box top (% of template)
              <input
                type="number"
                min="0"
                max="95"
                value={Math.round(box.y * 100)}
                onChange={(e) =>
                  setBox((b) => ({ ...b, y: Math.min(1 - b.h, Math.max(0, (Number(e.target.value) || 0) / 100)) }))
                }
              />
            </label>
            <label>
              Box width (% of template)
              <input
                type="number"
                min="5"
                max="100"
                value={Math.round(box.w * 100)}
                onChange={(e) =>
                  setBox((b) => ({ ...b, w: Math.min(1, Math.max(0.05, (Number(e.target.value) || 0) / 100)) }))
                }
              />
            </label>
            <label>
              Box height (% of template)
              <input
                type="number"
                min="5"
                max="100"
                value={Math.round(box.h * 100)}
                onChange={(e) =>
                  setBox((b) => ({ ...b, h: Math.min(1, Math.max(0.05, (Number(e.target.value) || 0) / 100)) }))
                }
              />
            </label>
          </div>
          <p>
            <button type="button" onClick={saveTemplate} disabled={savingTemplate}>
              {savingTemplate ? "Saving..." : "Save template & placement"}
            </button>
          </p>
          {templateMessage && <p>{templateMessage}</p>}
        </>
      )}

      <h3>3. Generate</h3>
      {registrations.length === 0 ? (
        <p>
          Certificates can only be generated for students marked Present, and no student is marked Present
          for this event yet. Mark attendance first, then come back here to generate.{" "}
          <Link href={`/admin/events/${eventId}/attendance`}>Mark attendance for this event</Link>
        </p>
      ) : (
        <>
          <p>
            {templateSaved
              ? `${registrations.length} Present student${registrations.length === 1 ? "" : "s"} will get a certificate.`
              : "Save a template and placement first, then you can generate."}
          </p>
          <p>
            <button type="button" onClick={generate} disabled={!templateSaved || generating || templateDirty}>
              {generating ? "Generating..." : "Generate certificates"}
            </button>
          </p>
          {templateDirty && <p>Save template &amp; placement first — your changes are not saved yet.</p>}
          {generateMessage && <p>{generateMessage}</p>}
        </>
      )}

      {rows && (
        <>
          <h3>4. Review before saving</h3>
          <p>
            {includedCount} of {rows.length} will be saved. Each row shows the name exactly as it will appear
            on the certificate. You can edit a printed name or remove a student from this batch. Nothing is
            sent yet: saved certificates start unticked, and you send them with the table below.
          </p>
          <div className="certgen-review">
            {rows.map((row) => (
              <ReviewRow
                key={row.registrationId}
                row={row}
                templateUrl={savedTemplate.url}
                box={savedTemplate.box}
                pageWidth={pageWidthRef.current}
                fontId={savedTemplate.font}
                onNameChange={(printedName) =>
                  setRows((current) =>
                    current.map((r) => (r.registrationId === row.registrationId ? { ...r, printedName } : r))
                  )
                }
                onNameBlur={() => recheckRow(row)}
                onRemove={() =>
                  setRows((current) =>
                    current.map((r) => (r.registrationId === row.registrationId ? { ...r, removed: !r.removed } : r))
                  )
                }
              />
            ))}
          </div>
          <p>
            <button type="button" onClick={saveAll} disabled={saving || includedCount === 0}>
              {saving ? `Saving... ${savedCount} of ${includedCount} saved` : `Save ${includedCount} certificate${includedCount === 1 ? "" : "s"}`}
            </button>{" "}
            {failedRows.length > 0 && !saving && (
              <button type="button" onClick={retryFailed}>
                Retry {failedRows.length} failed
              </button>
            )}
          </p>
          {saveMessage && <p>{saveMessage}</p>}
        </>
      )}
    </section>
  );
}

// The template preview with a draggable, resizable name box.
// The box is stored as fractions of the image size, so dragging
// and resizing only ever change those fractions.
function PlacementEditor({ templateUrl, box, onBoxChange, fontId, size, sampleName }) {
  const containerRef = useRef(null);
  const dragRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [aspect, setAspect] = useState(842 / 595);

  useEffect(() => {
    function measure() {
      if (containerRef.current) setContainerWidth(containerRef.current.offsetWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

  useEffect(() => {
    function onMove(e) {
      const drag = dragRef.current;
      if (!drag || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const dx = (e.clientX - drag.startX) / rect.width;
      const dy = (e.clientY - drag.startY) / rect.height;
      if (drag.mode === "move") {
        onBoxChange({
          ...drag.startBox,
          x: Math.min(1 - drag.startBox.w, Math.max(0, drag.startBox.x + dx)),
          y: Math.min(1 - drag.startBox.h, Math.max(0, drag.startBox.y + dy)),
        });
      } else {
        onBoxChange({
          ...drag.startBox,
          w: Math.min(1 - drag.startBox.x, Math.max(0.05, drag.startBox.w + dx)),
          h: Math.min(1 - drag.startBox.y, Math.max(0.05, drag.startBox.h + dy)),
        });
      }
    }
    function onUp() {
      dragRef.current = null;
    }
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [onBoxChange]);

  const pageWidth = pageSizeForAspect(aspect).width;
  const samplePx = containerWidth > 0 ? Math.max(8, Math.round((size * containerWidth) / pageWidth)) : size;

  return (
    <div
      className="certgen-placement"
      ref={containerRef}
      onPointerDown={(e) => {
        // Clicking the image itself does nothing; only the box moves.
        e.preventDefault();
      }}
    >
      <img
        src={templateUrl}
        alt="Certificate template preview"
        onLoad={(e) => {
          const img = e.target;
          if (img.naturalWidth && img.naturalHeight) setAspect(img.naturalWidth / img.naturalHeight);
        }}
      />
      <div
        className="certgen-box"
        style={{
          left: `${box.x * 100}%`,
          top: `${box.y * 100}%`,
          width: `${box.w * 100}%`,
          height: `${box.h * 100}%`,
        }}
        onPointerDown={(e) => {
          e.stopPropagation();
          dragRef.current = { mode: "move", startX: e.clientX, startY: e.clientY, startBox: box };
        }}
      >
        <span
          className="certgen-box__name"
          style={{
            fontSize: `${samplePx}px`,
            fontFamily: fontId === "lora" ? "Lora, serif" : "'Hanken Grotesk', sans-serif",
            fontWeight: 700,
          }}
        >
          {sampleName}
        </span>
        <span
          className="certgen-box__handle"
          title="Drag to resize"
          tabIndex={0}
          role="slider"
          aria-label="Resize name box"
          onPointerDown={(e) => {
            e.stopPropagation();
            dragRef.current = { mode: "resize", startX: e.clientX, startY: e.clientY, startBox: box };
          }}
        />
      </div>
    </div>
  );
}

// One review row: the template with this student's printed name
// placed on it, an editable printed name, the USN (so two students
// with the same name are easy to tell apart), the font warning if
// any, and a remove button. The preview scales the name from the
// PDF size by the preview width over the PDF page width, so what
// the admin sees is where the name will land.
function ReviewRow({ row, templateUrl, box, pageWidth, fontId, onNameChange, onNameBlur, onRemove }) {
  const containerRef = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    function measure() {
      if (containerRef.current) setWidth(containerRef.current.offsetWidth);
    }
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);
  const namePx = width > 0 ? Math.max(8, Math.round((row.fittedSize * width) / pageWidth)) : row.fittedSize;
  return (
    <div className={`certgen-row${row.removed ? " certgen-row--removed" : ""}`}>
      <div className="certgen-row__preview" ref={containerRef}>
        <img src={templateUrl} alt="" />
        {!row.removed && (
          <span
            className="certgen-row__name"
            style={{
              left: `${box.x * 100}%`,
              top: `${box.y * 100}%`,
              width: `${box.w * 100}%`,
              height: `${box.h * 100}%`,
              fontSize: `${namePx}px`,
              fontFamily: fontId === "lora" ? "Lora, serif" : "'Hanken Grotesk', sans-serif",
              fontWeight: 700,
            }}
          >
            {row.printedName}
          </span>
        )}
      </div>
      <div className="certgen-row__details">
        <label>
          Printed name
          <input
            type="text"
            value={row.printedName}
            disabled={row.removed || row.saveStatus === "saved"}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onNameBlur}
          />
        </label>
        <p>
          {row.name} — USN {row.usn}
        </p>
        {row.missingGlyphs.length > 0 && (
          <p className="error">
            This font cannot print {row.missingGlyphs.map((c) => `'${c}'`).join(", ")} — pick another font or
            edit the printed name. This student is not saved with the rest.
          </p>
        )}
        {row.saveStatus === "failed" && <p className="error">{row.saveError}</p>}
        {row.saveStatus === "saved" && <p>Saved. It is unticked in the table below.</p>}
        {row.saveStatus === "saving" && <p>Saving...</p>}
        <button type="button" onClick={onRemove} disabled={row.saveStatus === "saved"}>
          {row.removed ? "Add back to batch" : "Remove from batch ✕"}
        </button>
      </div>
    </div>
  );
}
