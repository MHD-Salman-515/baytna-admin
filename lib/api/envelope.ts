// The one place that knows about the backend's { success, data } envelope.
// Used by both the browser client and the server-side auth proxy.

import { ApiError } from "./errors";

type ErrorBody = {
  statusCode?: number;
  message?: string | string[];
  error?: string;
};

type Envelope<T> = { success: true; data: T } | { success: false; error: ErrorBody };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

export function normaliseMessages(message: unknown): string[] {
  if (Array.isArray(message)) return message.filter((m): m is string => typeof m === "string");
  if (typeof message === "string" && message) return [message];
  return [];
}

/** Converts a fetch Response into its unwrapped `data`, or throws ApiError. */
export async function unwrapResponse<T>(res: Response): Promise<T> {
  if (res.status === 204) return undefined as T;

  let body: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = null;
    }
  }

  if (isObject(body) && "success" in body) {
    const env = body as Envelope<T>;
    if (env.success) return env.data;
    const err = env.error ?? {};
    throw new ApiError({
      kind: "http",
      status: err.statusCode ?? res.status,
      messages: normaliseMessages(err.message),
      code: err.error,
    });
  }

  if (!res.ok) {
    throw new ApiError({ kind: "http", status: res.status, code: res.statusText || "HTTP error" });
  }
  // A 2xx without an envelope: hand back whatever it was.
  return body as T;
}

/** Wraps fetch with a timeout and maps transport failures to ApiError. */
export async function fetchWithTimeout(
  input: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outer = init.signal;
  const onOuterAbort = () => controller.abort();
  outer?.addEventListener("abort", onOuterAbort);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (e) {
    if (outer?.aborted) throw e; // caller cancelled (e.g. React Query); let it propagate
    if (controller.signal.aborted) throw new ApiError({ kind: "timeout" });
    throw new ApiError({ kind: "network", messages: e instanceof Error ? [e.message] : [] });
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuterAbort);
  }
}
