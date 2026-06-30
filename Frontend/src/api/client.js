import { MOCK_AUDIT, MOCK_BATCH, MOCK_DOCUMENT, MOCK_SUMMARY } from "./mock.js";

// Empty string uses Vite's dev proxy; override with VITE_API_URL for production.
const BASE_URL = import.meta.env.VITE_API_URL ?? "";

// When the backend is unreachable we fall back to mock data so the UI
// remains fully driveable without a live server.
let useMock = false;
const mockListeners = new Set();

// Subscribe to be notified when mock mode activates. Returns an unsubscribe fn.
export const onMockActivated = (fn) => {
  mockListeners.add(fn);
  return () => mockListeners.delete(fn);
};

export const isMockMode = () => useMock;

async function request(path, options = {}) {
  if (useMock) throw new Error("mock");
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.message ?? res.statusText), { status: res.status, body });
    }
    return res.json();
  } catch (err) {
    if (err.name === "TypeError") {
      // Network error — fall back to mock for the rest of the session.
      if (!useMock) {
        useMock = true;
        mockListeners.forEach((fn) => fn());
      }
      throw new Error("mock");
    }
    throw err;
  }
}

async function requestBlob(path, options = {}) {
  if (useMock) throw new Error("mock");
  try {
    const res = await fetch(`${BASE_URL}${path}`, options);
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw Object.assign(new Error(body.error?.message ?? body.message ?? res.statusText), { status: res.status, body });
    }
    return {
      blob: await res.blob(),
      filename: filenameFromContentDisposition(res.headers.get("content-disposition")),
    };
  } catch (err) {
    if (err.name === "TypeError") {
      if (!useMock) {
        useMock = true;
        mockListeners.forEach((fn) => fn());
      }
      throw new Error("mock");
    }
    throw err;
  }
}

function filenameFromContentDisposition(header) {
  if (!header) return null;
  const utf8Match = header.match(/filename\*=UTF-8''([^;]+)/i);
  if (utf8Match) return decodeURIComponent(utf8Match[1].replace(/"/g, ""));
  const match = header.match(/filename="?([^"]+)"?/i);
  return match?.[1] ?? null;
}

function redactedFilename(originalFilename = "document.txt") {
  const base = originalFilename
    .replace(/\.[^/.]+$/, "")
    .replace(/[^a-z0-9._-]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80) || "document";
  return `${base}.redacted.txt`;
}

function buildMockRedactedText(doc) {
  const spans = [...(doc?.spans ?? [])]
    .filter((span) => span.status === "accepted" || span.status === "overridden")
    .sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset);
  const merged = [];

  for (const span of spans) {
    const prev = merged[merged.length - 1];
    if (prev && span.startOffset < prev.endOffset) {
      prev.endOffset = Math.max(prev.endOffset, span.endOffset);
    } else {
      merged.push({ ...span });
    }
  }

  let output = doc?.rawText ?? "";
  for (let i = merged.length - 1; i >= 0; i -= 1) {
    const span = merged[i];
    output = `${output.slice(0, span.startOffset)}[REDACTED:${span.type}]${output.slice(span.endOffset)}`;
  }
  return output;
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ── Documents ──────────────────────────────────────────────────────────────

export async function uploadDocument(file) {
  const form = new FormData();
  form.append("file", file);
  try {
    return await request("/documents", { method: "POST", body: form });
  } catch (e) {
    if (e.message === "mock") return { id: MOCK_DOCUMENT.id, status: "pending" };
    throw e;
  }
}

export async function getDocument(id) {
  try {
    return await request(`/documents/${id}`);
  } catch (e) {
    if (e.message === "mock") return structuredClone(MOCK_DOCUMENT);
    throw e;
  }
}

export async function getSummary(id) {
  try {
    return await request(`/documents/${id}/summary`);
  } catch (e) {
    if (e.message === "mock") return structuredClone(MOCK_SUMMARY);
    throw e;
  }
}

// ── Spans ──────────────────────────────────────────────────────────────────

export async function patchSpan(documentId, spanId, payload) {
  // payload: { action: "accept" | "reject" | "override", overrideType?: string, actor?: string }
  try {
    return await request(`/documents/${documentId}/spans/${spanId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    if (e.message === "mock") return { spanId, ...payload };
    throw e;
  }
}

export async function bulkUpdateSpans(documentId, payload) {
  // payload: { spanIds: string[], action: "accept" | "reject", dryRun: boolean, actor?: string }
  try {
    return await request(`/documents/${documentId}/spans/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (e) {
    if (e.message === "mock") return { updated: payload.spanIds.length };
    throw e;
  }
}

// ── Commit ─────────────────────────────────────────────────────────────────

export async function commitDocument(id) {
  try {
    return await request(`/documents/${id}/commit`, { method: "POST" });
  } catch (e) {
    if (e.message === "mock") return { id, status: "committed" };
    throw e;
  }
}

export async function downloadRedactedDocument(id, doc) {
  try {
    const { blob, filename } = await requestBlob(`/documents/${id}/download`);
    triggerDownload(blob, filename ?? redactedFilename(doc?.originalFilename));
  } catch (e) {
    if (e.message === "mock") {
      const text = buildMockRedactedText(doc ?? MOCK_DOCUMENT);
      const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
      triggerDownload(blob, redactedFilename(doc?.originalFilename ?? MOCK_DOCUMENT.originalFilename));
      return;
    }
    throw e;
  }
}

// ── Batches ────────────────────────────────────────────────────────────────

export async function uploadBatch(files) {
  const form = new FormData();
  for (const file of files) form.append("files", file);
  try {
    return await request("/batches", { method: "POST", body: form });
  } catch (e) {
    if (e.message === "mock") return structuredClone(MOCK_BATCH.uploadResponse);
    throw e;
  }
}

export async function getBatch(id) {
  try {
    return await request(`/batches/${id}`);
  } catch (e) {
    if (e.message === "mock") return structuredClone(MOCK_BATCH.batch);
    throw e;
  }
}

// ── Audit ──────────────────────────────────────────────────────────────────

export async function getAudit(id) {
  try {
    return await request(`/documents/${id}/audit`);
  } catch (e) {
    if (e.message === "mock") return structuredClone(MOCK_AUDIT);
    throw e;
  }
}

// ── Polling helper: poll until document status !== "pending" ───────────────

export async function pollUntilReady(id, { interval = 1500, maxAttempts = 40 } = {}) {
  for (let i = 0; i < maxAttempts; i++) {
    const doc = await getDocument(id);
    if (doc.status !== "pending") return doc;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error("Timed out waiting for document processing");
}
