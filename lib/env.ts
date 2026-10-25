// Public configuration. NEXT_PUBLIC_API_BASE_URL is the ONLY public env var;
// every secret is read server-side in lib/server.

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "https://baytna-api-z7v9.onrender.com/api/v1"
).replace(/\/+$/, "");

/** Staging sleeps on Render's free tier; the first request can take 30-60s. */
export const REQUEST_TIMEOUT_MS = 90_000;

/** After this long without a response we tell the admin the server is waking up. */
export const SLOW_REQUEST_MS = 4_000;
