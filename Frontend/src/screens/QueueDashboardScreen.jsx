import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, AlertTriangle, CheckCircle, Zap } from "lucide-react";
import { Badge } from "../components/ds/Badge.jsx";
import { Button } from "../components/ds/Button.jsx";
import { getBatch, commitDocument } from "../api/client.js";

function isFastTrackable(doc) {
  return doc.pendingCount === 0 && doc.status !== "committed";
}

function DocStatusBadge({ doc }) {
  if (doc.status === "committed") return <Badge tone="success">Committed</Badge>;
  if (doc.unresolvedHighRiskCount > 0) return <Badge tone="danger">{doc.unresolvedHighRiskCount} high-risk</Badge>;
  if (doc.conflictCount > 0) return <Badge tone="warning">{doc.conflictCount} conflict{doc.conflictCount !== 1 ? "s" : ""}</Badge>;
  if (doc.pendingCount === 0) return <Badge tone="neutral">Ready</Badge>;
  return <Badge tone="neutral">{doc.pendingCount} pending</Badge>;
}

export function QueueDashboardScreen() {
  const { id: batchId } = useParams();
  const navigate = useNavigate();
  const [batch, setBatch] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [fastTracking, setFastTracking] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getBatch(batchId);
      setBatch(data);
    } catch (e) {
      setError(e.message || "Failed to load batch.");
    } finally {
      setLoading(false);
    }
  }, [batchId]);

  useEffect(() => { load(); }, [load]);

  const handleFastTrack = async (doc) => {
    setFastTracking(doc.id);
    try {
      await commitDocument(doc.id);
      setBatch((prev) => ({
        ...prev,
        documents: prev.documents.map((d) =>
          d.id === doc.id ? { ...d, status: "committed", pendingCount: 0 } : d
        ),
      }));
    } catch (e) {
      // If commit fails (e.g. high-risk spans appeared), open the document for full review instead.
      navigate(`/document/${doc.id}`, { state: { batchId } });
    } finally {
      setFastTracking(null);
    }
  };

  if (loading) return <FullPageMsg>Loading batch…</FullPageMsg>;
  if (error) return <FullPageMsg error>Failed to load: {error}</FullPageMsg>;
  if (!batch) return null;

  const committed = batch.documents.filter((d) => d.status === "committed").length;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-page)", display: "flex", flexDirection: "column" }}>
      {/* Header */}
      <header style={{
        background: "var(--surface-raised)",
        borderBottom: "1px solid var(--border-subtle)",
        padding: "0 var(--space-6)",
        display: "flex", alignItems: "center", gap: "var(--space-4)",
        height: 56, flexShrink: 0,
      }}>
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
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "var(--fs-body-sm)" }}>
            Review queue
          </span>
          <span style={{ marginLeft: "var(--space-3)", fontSize: "var(--fs-caption)", color: "var(--text-muted)" }}>
            {batch.totalDocuments} document{batch.totalDocuments !== 1 ? "s" : ""} · {committed} committed
          </span>
        </div>
        {batch.status === "partial_failure" && (
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", fontSize: "var(--fs-caption)", color: "var(--warning-600)" }}>
            <AlertTriangle size={14} strokeWidth={2} />
            Some files failed to process
          </div>
        )}
      </header>

      {/* Queue table */}
      <main style={{ flex: 1, overflow: "auto", padding: "var(--space-6)" }}>
        <div style={{ maxWidth: 900, margin: "0 auto" }}>

          {/* Isolation notice */}
          <p style={{
            fontSize: "var(--fs-caption)", color: "var(--text-muted)",
            marginBottom: "var(--space-4)",
            padding: "var(--space-3) var(--space-4)",
            background: "var(--surface-card)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border-subtle)",
          }}>
            Each document is reviewed independently. Matching names or values across files do not imply a shared identity — no corrections are ever cascaded between documents.
          </p>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border-subtle)" }}>
                {["Document", "Spans", "Status", "Priority score", "Action"].map((col) => (
                  <th key={col} style={{
                    padding: "var(--space-2) var(--space-3)",
                    textAlign: col === "Action" ? "right" : "left",
                    fontSize: "var(--fs-caption)", fontWeight: 600,
                    color: "var(--text-muted)", letterSpacing: "0.04em",
                    textTransform: "uppercase",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {batch.documents.map((doc) => {
                const fastTrackable = isFastTrackable(doc);
                const isCommitted = doc.status === "committed";
                return (
                  <tr
                    key={doc.id}
                    style={{
                      borderBottom: "1px solid var(--border-subtle)",
                      background: isCommitted ? "var(--success-100)" : "var(--surface-card)",
                      transition: "background var(--dur-fast) var(--ease-standard)",
                    }}
                  >
                    {/* Filename */}
                    <td style={{ padding: "var(--space-3)", maxWidth: 260 }}>
                      <span style={{
                        fontSize: "var(--fs-body-sm)", color: "var(--text-primary)", fontWeight: 500,
                        display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {doc.originalFilename}
                      </span>
                    </td>

                    {/* Span count */}
                    <td style={{ padding: "var(--space-3)", fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)" }}>
                      {doc.totalSpans}
                    </td>

                    {/* Status badge */}
                    <td style={{ padding: "var(--space-3)" }}>
                      <DocStatusBadge doc={doc} />
                    </td>

                    {/* Priority score */}
                    <td style={{ padding: "var(--space-3)", fontSize: "var(--fs-body-sm)", color: "var(--text-secondary)" }}>
                      {isCommitted ? "—" : doc.docPriorityScore.toFixed(1)}
                    </td>

                    {/* Action */}
                    <td style={{ padding: "var(--space-3)", textAlign: "right" }}>
                      {isCommitted ? (
                        <span style={{ display: "flex", alignItems: "center", gap: "var(--space-1)", justifyContent: "flex-end", color: "var(--success-600)", fontSize: "var(--fs-caption)" }}>
                          <CheckCircle size={14} strokeWidth={2} />
                          Done
                        </span>
                      ) : fastTrackable ? (
                        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", justifyContent: "flex-end" }}>
                          <button
                            onClick={() => navigate(`/document/${doc.id}`, { state: { batchId } })}
                            style={{
                              border: "none", background: "transparent", cursor: "pointer",
                              fontSize: "var(--fs-caption)", color: "var(--text-muted)",
                              padding: "var(--space-1) var(--space-2)", borderRadius: "var(--radius-xs)",
                              textDecoration: "underline",
                            }}
                          >
                            Review
                          </button>
                          <Button
                            variant="secondary"
                            size="sm"
                            iconLeft={<Zap size={13} strokeWidth={2} />}
                            disabled={fastTracking === doc.id}
                            onClick={() => handleFastTrack(doc)}
                            title="No pending spans — commit without opening the review screen"
                          >
                            {fastTracking === doc.id ? "Committing…" : "Fast-track"}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => navigate(`/document/${doc.id}`, { state: { batchId } })}
                        >
                          Review
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {batch.documents.length === 0 && (
            <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "var(--space-8)", fontSize: "var(--fs-body-sm)" }}>
              No documents in this batch.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}

function FullPageMsg({ children, error }) {
  return (
    <div style={{
      minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
      color: error ? "var(--danger-600)" : "var(--text-muted)", fontSize: "var(--fs-body-sm)",
    }}>
      {children}
    </div>
  );
}
