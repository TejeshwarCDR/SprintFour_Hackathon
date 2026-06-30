import { useCallback, useEffect, useRef, useState } from "react";
import { getAudit, getDocument, getSummary, patchSpan, bulkUpdateSpans, commitDocument, downloadRedactedDocument } from "./client.js";

export function useDocument(id) {
  const [doc, setDoc] = useState(null);
  const [summary, setSummary] = useState(null);
  const [audit, setAudit] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [mutationError, setMutationError] = useState(null);
  const spansRef = useRef({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [d, s, a] = await Promise.all([getDocument(id), getSummary(id), getAudit(id)]);
      setDoc(d);
      setSummary(s);
      setAudit(a);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const updateSpanLocally = useCallback((spanId, patch) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        spans: prev.spans.map((s) => s.id === spanId ? { ...s, ...patch } : s),
      };
    });
  }, []);

  const clearMutationError = useCallback(() => setMutationError(null), []);

  const acceptSpan = useCallback(async (spanId) => {
    updateSpanLocally(spanId, { status: "accepted" });
    try {
      await patchSpan(id, spanId, { action: "accept" });
    } catch (e) {
      updateSpanLocally(spanId, { status: "pending" });
      setMutationError(e.message || "Failed to accept span");
    }
  }, [id, updateSpanLocally]);

  const rejectSpan = useCallback(async (spanId) => {
    updateSpanLocally(spanId, { status: "rejected" });
    try {
      await patchSpan(id, spanId, { action: "reject" });
    } catch (e) {
      updateSpanLocally(spanId, { status: "pending" });
      setMutationError(e.message || "Failed to reject span");
    }
  }, [id, updateSpanLocally]);

  const overrideSpan = useCallback(async (spanId, overrideType) => {
    updateSpanLocally(spanId, { status: "overridden", type: overrideType });
    try {
      await patchSpan(id, spanId, { action: "override", overrideType });
    } catch (e) {
      updateSpanLocally(spanId, { status: "pending" });
      setMutationError(e.message || "Failed to override span");
    }
  }, [id, updateSpanLocally]);

  const bulkAccept = useCallback(async (spanIds) => {
    spanIds.forEach((sid) => updateSpanLocally(sid, { status: "accepted" }));
    try {
      await bulkUpdateSpans(id, { spanIds, action: "accept", dryRun: false });
    } catch (e) {
      spanIds.forEach((sid) => updateSpanLocally(sid, { status: "pending" }));
      setMutationError(e.message || "Failed to bulk accept spans");
    }
  }, [id, updateSpanLocally]);

  // Pre-check fast-path: uses action "auto_accept_suggested" so audit entries are
  // distinguishable from manually reviewed accepts (actor stored as "system:pre_check").
  const bulkAcceptPreChecked = useCallback(async (spanIds) => {
    spanIds.forEach((sid) => updateSpanLocally(sid, { status: "accepted" }));
    try {
      await bulkUpdateSpans(id, { spanIds, action: "auto_accept_suggested", dryRun: false });
    } catch (e) {
      spanIds.forEach((sid) => updateSpanLocally(sid, { status: "pending" }));
      setMutationError(e.message || "Failed to auto-accept pre-checked spans");
    }
  }, [id, updateSpanLocally]);

  const bulkReject = useCallback(async (spanIds) => {
    spanIds.forEach((sid) => updateSpanLocally(sid, { status: "rejected" }));
    try {
      await bulkUpdateSpans(id, { spanIds, action: "reject", dryRun: false });
    } catch (e) {
      spanIds.forEach((sid) => updateSpanLocally(sid, { status: "pending" }));
      setMutationError(e.message || "Failed to bulk reject spans");
    }
  }, [id, updateSpanLocally]);

  const commit = useCallback(async () => {
    try {
      const result = await commitDocument(id);
      setDoc((prev) => prev ? { ...prev, status: "committed" } : prev);
      return result;
    } catch (e) {
      setMutationError(e.message || "Failed to commit document");
      throw e;
    }
  }, [id]);

  const downloadRedacted = useCallback(async () => {
    if (!doc) return;
    try {
      await downloadRedactedDocument(id, doc);
    } catch (e) {
      setMutationError(e.message || "Failed to download redacted file");
      throw e;
    }
  }, [doc, id]);

  const refreshAudit = useCallback(async () => {
    const a = await getAudit(id);
    setAudit(a);
  }, [id]);

  return {
    doc,
    summary,
    audit,
    loading,
    error,
    mutationError,
    clearMutationError,
    reload: load,
    acceptSpan,
    rejectSpan,
    overrideSpan,
    bulkAccept,
    bulkAcceptPreChecked,
    bulkReject,
    commit,
    downloadRedacted,
    refreshAudit,
  };
}
