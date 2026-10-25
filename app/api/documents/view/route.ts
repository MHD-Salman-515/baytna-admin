// Streams one worker document to the admin who opened it.
//
// The backend issues a 5-minute presigned URL and writes an audit entry each
// time it does. This handler fetches that URL and then the bytes server-side,
// so the presigned URL never reaches the browser: it can't land in history,
// the HTTP cache, devtools, extensions, or a shareable link. The response is
// a POST body marked no-store; the browser renders it from memory and drops it.
//
// Never log anything here: not the token, the URL, or the document.

import { API_BASE_URL } from "@/lib/env";
import type { DocumentUrlResponse } from "@/lib/api/types";
import { fetchWithTimeout, unwrapResponse } from "@/lib/api/envelope";
import { fail, failFrom, isCrossSite } from "@/lib/server/backend";

export const maxDuration = 60;

const OBJECT_ID = /^[a-f0-9]{24}$/;
const MAX_BYTES = 20 * 1024 * 1024;
/** Error code the viewer recognises; kept in sync with features/workers/document-viewer.tsx. */
const INSECURE_URL = "InsecureDocumentUrl";
const ALLOWED_TYPES =new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export async function POST(request: Request) {
  if (isCrossSite(request)) return fail(403, "Cross-site request rejected", "Forbidden");

  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return fail(401, "Missing access token", "Unauthorized");

  let body: { workerId?: unknown; docId?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail(400, "Invalid JSON", "Bad Request");
  }
  const { workerId, docId } = body;
  if (typeof workerId !== "string" || !OBJECT_ID.test(workerId) || typeof docId !== "string" || !OBJECT_ID.test(docId)) {
    return fail(400, "workerId and docId must be ids", "Bad Request");
  }

  // 1. Ask the backend for the presigned URL, as the admin (this is the audited access).
  let url: string;
  try {
    const res = await fetchWithTimeout(
      `${API_BASE_URL}/admin/workers/${workerId}/documents/${docId}/url`,
      { headers: { authorization, accept: "application/json" }, cache: "no-store" },
      60_000,
    );
    const data = await unwrapResponse<Partial<DocumentUrlResponse> | null>(res);
    if (typeof data?.url !== "string") {
      const keys = data && typeof data === "object" ? Object.keys(data).join(",") : typeof data;
      return fail(502, `Unexpected document URL response (keys: ${keys})`, "Bad Gateway");
    }
    // The URL may be relative to the API. Accept HTTPS anywhere, or the API's own origin.
    const apiOrigin = new URL(API_BASE_URL).origin;
    const resolved = new URL(data.url, apiOrigin);
    const sameOrigin = resolved.origin === apiOrigin;
    if (resolved.protocol !== "https:" && !sameOrigin) {
      // Fetching an identity document over plain HTTP would expose it in transit. Refuse.
      return fail(502, `Refusing document URL (scheme: ${resolved.protocol}, sameOriginAsApi: ${sameOrigin})`, INSECURE_URL);
    }
    url = resolved.toString();
  } catch (e) {
    return failFrom(e);
  }

  // 2. Fetch the bytes. The URL is single-use from our point of view and is discarded here.
  let upstream: Response;
  try {
    upstream = await fetchWithTimeout(url, { cache: "no-store", redirect: "error" }, 30_000);
  } catch (e) {
    return failFrom(e);
  }
  if (!upstream.ok) {
    return fail(upstream.status === 403 ? 410 : 502, "Document storage refused the request", "Bad Gateway");
  }

  const declared = Number(upstream.headers.get("content-length") ?? 0);
  if (declared > MAX_BYTES) return fail(413, "Document too large to display", "Payload Too Large");

  const upstreamType = (upstream.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
  const hinted = typeof body.mimeType === "string" ? body.mimeType.toLowerCase() : "";
  const type = ALLOWED_TYPES.has(upstreamType) ? upstreamType : ALLOWED_TYPES.has(hinted) ? hinted : "";
  if (!type) return fail(415, "Unsupported document type", "Unsupported Media Type");

  const bytes = await upstream.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return fail(413, "Document too large to display", "Payload Too Large");

  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": type,
      "cache-control": "no-store, private, max-age=0",
      "x-content-type-options": "nosniff",
      "content-security-policy": "sandbox; default-src 'none'",
    },
  });
}
