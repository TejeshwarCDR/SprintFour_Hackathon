import React from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Files } from "lucide-react";
import { Card } from "../components/ds/Card.jsx";

export function LandingScreen() {
  const navigate = useNavigate();

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
      <div style={{ width: "100%", maxWidth: 560 }}>
        <div style={{ marginBottom: "var(--space-8)", textAlign: "center" }}>
          <span style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48,
            background: "var(--ink-100)", borderRadius: "var(--radius-md)",
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
            Choose how to start your redaction review.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "var(--space-4)" }}>
          <Card
            interactive
            style={{ padding: "var(--space-6)", cursor: "pointer" }}
            onClick={() => navigate("/upload")}
          >
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40,
              background: "var(--ink-100)", borderRadius: "var(--radius-sm)",
              marginBottom: "var(--space-4)",
            }}>
              <FileText size={20} color="var(--ink-600)" strokeWidth={1.75} />
            </span>
            <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              Single document
            </p>
            <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-relaxed)" }}>
              Upload one file and step through Explain and Review mode at your own pace.
            </p>
          </Card>

          <Card
            interactive
            style={{ padding: "var(--space-6)", cursor: "pointer" }}
            onClick={() => navigate("/bulk")}
          >
            <span style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 40, height: 40,
              background: "var(--ink-100)", borderRadius: "var(--radius-sm)",
              marginBottom: "var(--space-4)",
            }}>
              <Files size={20} color="var(--ink-600)" strokeWidth={1.75} />
            </span>
            <p style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: "var(--space-2)" }}>
              Bulk upload
            </p>
            <p style={{ fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)", lineHeight: "var(--lh-relaxed)" }}>
              Upload up to 50 files at once. A priority queue surfaces the highest-risk documents first.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
