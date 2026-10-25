// Typed errors for everything that can go wrong talking to the backend.
// Feature code branches on `kind` / `status`, never on raw response bodies.

export type ApiErrorKind =
  | "http" // backend answered with { success: false, error }
  | "network" // fetch itself failed (offline, DNS, CORS)
  | "timeout" // gave up waiting (staging may be asleep for 30-60s)
  | "session"; // refresh failed; the user has been logged out

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number;
  /** Backend `message`, always normalised to an array (it is sometimes a string). */
  readonly messages: string[];
  /** Backend `error` field, e.g. "Bad Request", or a short code we assign. */
  readonly code: string;

  constructor(opts: { kind: ApiErrorKind; status?: number; messages?: string[]; code?: string }) {
    const messages = opts.messages ?? [];
    super(messages.join("; ") || opts.code || opts.kind);
    this.name = "ApiError";
    this.kind = opts.kind;
    this.status = opts.status ?? 0;
    this.messages = messages;
    this.code = opts.code ?? opts.kind;
  }

  get isUnauthorized() {
    return this.kind === "http" && this.status === 401;
  }

  get isForbidden() {
    return this.kind === "http" && this.status === 403;
  }

  get isNotFound() {
    return this.kind === "http" && this.status === 404;
  }

  /** True when retrying later could succeed (server asleep, network blip). */
  get isTransient() {
    return this.kind === "network" || this.kind === "timeout" || this.status >= 500;
  }
}

export function isApiError(e: unknown): e is ApiError {
  return e instanceof ApiError;
}
