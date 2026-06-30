import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { FileText } from "lucide-react";
import { pollUntilReady } from "../api/client.js";

export function ProcessingScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    pollUntilReady(id)
      .then((doc) => {
        if (!cancelled) navigate(`/document/${doc.id}`, { replace: true });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });
    return () => { cancelled = true; };
  }, [id, navigate]);

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-page)",
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      gap: "var(--space-5)",
      padding: "var(--space-6)",
    }}>
      <span style={{
        width: 52, height: 52,
        background: "var(--ink-100)", borderRadius: "var(--radius-md)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <FileText size={26} color="var(--ink-600)" strokeWidth={1.75} />
      </span>

      {error ? (
        <div role="alert" aria-live="assertive" style={{ textAlign: "center" }}>
          <p style={{ fontWeight: 600, color: "var(--danger-600)", marginBottom: 4 }}>Processing failed</p>
          <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)" }}>{error}</p>
        </div>
      ) : (
        <div role="status" aria-live="polite" style={{ textAlign: "center" }}>
          <p style={{
            fontWeight: 600,
            color: "var(--text-primary)",
            marginBottom: "var(--space-2)",
          }}>
            Scanning document…
          </p>
          <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-muted)" }}>
            Running LLM and ontology detection. This takes a few seconds.
          </p>
          <div style={{
            marginTop: "var(--space-5)",
            height: 4,
            width: 240,
            background: "var(--paper-300)",
            borderRadius: "var(--radius-pill)",
            overflow: "hidden",
            margin: "var(--space-5) auto 0",
          }}>
            <div style={{
              height: "100%",
              width: "40%",
              background: "var(--ink-600)",
              borderRadius: "var(--radius-pill)",
              animation: "scan-pulse 1.6s ease-in-out infinite",
            }} />
          </div>
        </div>
      )}

      <style>{`
        @keyframes scan-pulse {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(350%); }
        }
      `}</style>
    </div>
  );
}
