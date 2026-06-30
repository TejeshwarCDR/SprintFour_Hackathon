import React, { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Upload, X, AlertCircle, FileText } from "lucide-react";
import { Button } from "../components/ds/Button.jsx";
import { uploadBatch } from "../api/client.js";

const ACCEPTED_EXTS = /\.(txt|pdf|docx)$/i;
const MAX_BYTES = 5 * 1024 * 1024;
const MAX_FILES = 50;

function validateFile(f) {
  if (!ACCEPTED_EXTS.test(f.name)) return "Only .txt, .pdf, and .docx files are accepted.";
  if (f.size > MAX_BYTES) return `${f.name} exceeds 5 MB.`;
  return null;
}

export function BulkUploadScreen() {
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [files, setFiles] = useState([]);
  const [validationError, setValidationError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);

  const addFiles = useCallback((incoming) => {
    setValidationError(null);
    const errors = [];
    const valid = [];
    for (const f of incoming) {
      const err = validateFile(f);
      if (err) errors.push(err);
      else valid.push(f);
    }
    if (errors.length > 0) {
      setValidationError(errors[0]);
    }
    setFiles((prev) => {
      const combined = [...prev, ...valid];
      if (combined.length > MAX_FILES) {
        setValidationError(`Maximum ${MAX_FILES} files per batch.`);
        return prev;
      }
      return combined;
    });
  }, []);

  const removeFile = useCallback((index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setValidationError(null);
  }, []);

  const onDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    addFiles([...e.dataTransfer.files]);
  }, [addFiles]);

  const onInput = (e) => {
    addFiles([...e.target.files]);
    e.target.value = "";
  };

  const submit = async () => {
    if (files.length === 0) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const { batchId } = await uploadBatch(files);
      navigate(`/batch/${batchId}`);
    } catch (e) {
      setSubmitError("Batch upload failed — please try again.");
      setSubmitting(false);
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
      <div style={{ width: "100%", maxWidth: 600 }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)", marginBottom: "var(--space-7)" }}>
          <button
            onClick={() => navigate("/")}
            aria-label="Back to start"
            style={{
              border: "none", background: "transparent", cursor: "pointer",
              color: "var(--text-muted)", display: "flex", alignItems: "center",
              padding: "var(--space-1)", borderRadius: "var(--radius-sm)",
            }}
          >
            <ArrowLeft size={18} strokeWidth={2} />
          </button>
          <div>
            <h1 style={{ fontSize: "var(--fs-h3)", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              Bulk upload
            </h1>
            <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", margin: 0 }}>
              Up to {MAX_FILES} files — .txt, .pdf, .docx, max 5 MB each.
            </p>
          </div>
        </div>

        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          aria-label="Drop zone — click or drag to add files"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") inputRef.current?.click(); }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          style={{
            border: `2px dashed ${dragOver ? "var(--ink-600)" : "var(--border-default)"}`,
            borderRadius: "var(--radius-lg)",
            background: dragOver ? "var(--ink-100)" : "var(--surface-card)",
            padding: "var(--space-7) var(--space-6)",
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
            multiple
            onChange={onInput}
            style={{ display: "none" }}
          />
          <Upload size={28} color="var(--slate-400)" strokeWidth={1.5} style={{ marginBottom: "var(--space-3)" }} />
          <p style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
            Drop files here, or click to browse
          </p>
          <p style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
            Multiple files accepted
          </p>
        </div>

        {/* Validation error */}
        {validationError && (
          <div style={{
            marginTop: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--danger-100)",
            borderRadius: "var(--radius-sm)",
            display: "flex", alignItems: "center", gap: "var(--space-2)",
          }}>
            <AlertCircle size={16} color="var(--danger-600)" strokeWidth={2} />
            <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--danger-600)" }}>{validationError}</span>
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div style={{
            marginTop: "var(--space-4)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
          }}>
            <div style={{
              padding: "var(--space-2) var(--space-4)",
              background: "var(--surface-raised)",
              borderBottom: "1px solid var(--border-subtle)",
              fontSize: "var(--fs-caption)",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}>
              {files.length} file{files.length !== 1 ? "s" : ""} queued
            </div>
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {files.map((f, i) => (
                <li key={`${f.name}-${i}`} style={{
                  display: "flex", alignItems: "center", gap: "var(--space-3)",
                  padding: "var(--space-3) var(--space-4)",
                  borderBottom: i < files.length - 1 ? "1px solid var(--border-subtle)" : "none",
                  background: "var(--surface-card)",
                }}>
                  <FileText size={15} color="var(--text-muted)" strokeWidth={1.75} style={{ flexShrink: 0 }} />
                  <span style={{
                    flex: 1, minWidth: 0,
                    fontSize: "var(--fs-body-sm)", color: "var(--text-primary)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {f.name}
                  </span>
                  <span style={{ fontSize: "var(--fs-caption)", color: "var(--text-muted)", flexShrink: 0 }}>
                    {(f.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                    aria-label={`Remove ${f.name}`}
                    style={{
                      border: "none", background: "transparent", cursor: "pointer",
                      color: "var(--text-muted)", display: "flex", alignItems: "center",
                      padding: 4, borderRadius: "var(--radius-xs)",
                      flexShrink: 0,
                    }}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div style={{
            marginTop: "var(--space-3)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--danger-100)",
            borderRadius: "var(--radius-sm)",
            display: "flex", alignItems: "center", gap: "var(--space-2)",
          }}>
            <AlertCircle size={16} color="var(--danger-600)" strokeWidth={2} />
            <span style={{ fontSize: "var(--fs-body-sm)", color: "var(--danger-600)" }}>{submitError}</span>
          </div>
        )}

        {/* Processing notice while in-flight */}
        {submitting && (
          <div style={{
            marginTop: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--ink-100)",
            borderRadius: "var(--radius-sm)",
            fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)",
          }}>
            Running detection on {files.length} file{files.length !== 1 ? "s" : ""}… This may take a few seconds per file.
          </div>
        )}

        <Button
          variant="primary"
          size="lg"
          block
          disabled={files.length === 0 || submitting}
          onClick={submit}
          style={{ marginTop: "var(--space-5)" }}
        >
          {submitting ? `Scanning ${files.length} files…` : `Scan ${files.length || ""} document${files.length !== 1 ? "s" : ""}`}
        </Button>
      </div>
    </div>
  );
}
