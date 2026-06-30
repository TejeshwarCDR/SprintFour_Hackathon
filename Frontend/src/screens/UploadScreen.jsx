import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileText, AlertCircle } from "lucide-react";
import { Button } from "../components/ds/Button.jsx";
import { uploadDocument } from "../api/client.js";

const ACCEPTED = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
];

export function UploadScreen() {
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState(null);
  const [error, setError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef(null);
  const navigate = useNavigate();

  const validate = (f) => {
    if (!ACCEPTED.includes(f.type) && !f.name.match(/\.(txt|pdf|docx)$/i)) {
      return "Only .txt, .pdf, and .docx files are accepted.";
    }
    if (f.size > 5 * 1024 * 1024) return "File must be under 5 MB.";
    return null;
  };

  const pick = useCallback((f) => {
    const err = validate(f);
    if (err) { setError(err); setFile(null); return; }
    setFile(f);
    setError(null);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) pick(f);
  }, [pick]);

  const onInput = (e) => {
    const f = e.target.files[0];
    if (f) pick(f);
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const { id } = await uploadDocument(file);
      navigate(`/processing/${id}`);
    } catch (e) {
      setError("Upload failed — please try again.");
      setUploading(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      padding: "var(--space-6)",
    }}>
      <div style={{ width: "100%", maxWidth: 520 }}>
        <div style={{ marginBottom: "var(--space-7)", textAlign: "center" }}>
          <span style={{
            display: "inline-block",
            width: 48, height: 48, marginBottom: "var(--space-4)",
            background: "var(--ink-100)", borderRadius: "var(--radius-md)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto var(--space-4)",
          }}>
            <FileText size={24} color="var(--ink-600)" strokeWidth={1.75} />
          </span>
          <h1 style={{
            fontFamily: "var(--font-body)",
            fontSize: "var(--fs-h3)",
            fontWeight: 700,
            color: "var(--text-primary)",
            marginBottom: "var(--space-2)",
          }}>
            Conseal
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "var(--fs-body-sm)" }}>
            Upload a document to begin redaction review.
          </p>
        </div>

        <div
          role="button"
          tabIndex={0}
          aria-label="Drop zone — click or drag to upload a document"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? "var(--ink-600)" : file ? "var(--success-600)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-lg)",
            background: dragOver ? "var(--ink-100)" : file ? "var(--success-100)" : "var(--surface-card)",
            padding: "var(--space-8) var(--space-6)",
            textAlign: "center",
            cursor: "pointer",
            transition: "border-color var(--dur-fast) var(--ease-standard), background var(--dur-fast) var(--ease-standard)",
            outline: "none",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".txt,.pdf,.docx"
            onChange={onInput}
            style={{ display: "none" }}
          />
          <Upload
            size={28}
            color={file ? "var(--success-600)" : "var(--slate-400)"}
            strokeWidth={1.5}
            style={{ marginBottom: "var(--space-3)" }}
          />
          {file ? (
            <>
              <p style={{ fontWeight: 600, color: "var(--success-600)", marginBottom: 4 }}>{file.name}</p>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                {(file.size / 1024).toFixed(0)} KB — click to change
              </p>
            </>
          ) : (
            <>
              <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                Drop a file here, or click to browse
              </p>
              <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
                .txt, .pdf, .docx — max 5 MB
              </p>
            </>
          )}
        </div>

        {error && (
          <div style={{
            marginTop: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--danger-100)",
            borderRadius: "var(--radius-sm)",
            display: "flex", alignItems: "center", gap: "var(--space-2)",
          }}>
            <AlertCircle size={16} color="var(--danger-600)" strokeWidth={2} />
            <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--danger-600)" }}>{error}</span>
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          block
          disabled={!file || uploading}
          onClick={submit}
          style={{ marginTop: "var(--space-5)" }}
        >
          {uploading ? "Uploading…" : "Scan document"}
        </Button>
      </div>
    </div>
  );
}
