# Baytna admin console

Operations console for the Baytna home-services marketplace (Syria, Iraq).
Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4, TanStack Query.
Arabic and right-to-left by default, English secondary.

This app has **no backend of its own**. It consumes the Baytna API; the only
server code here is a thin proxy for auth and for document viewing.

Built so far: login, app shell, dashboard, worker verification queue and
worker detail with document review. Not built yet: bookings, reports, panic
alerts, wallets, metrics (they appear disabled in the sidebar).

## Running it

```sh
npm install
cp .env.example .env.local   # then fill in DEV_OTP_KEY (see below)
npm run dev                  # http://localhost:3000
```

Sign in with a phone number that has the `ADMIN` role (staging test admin:
Syria, `0922222222`). Any other account is refused at login with an explicit
"not an admin" message.

The staging API sleeps on Render's free tier. The first request after a while
can take 30–60 s; the UI shows a "waking the server up" banner instead of an
error. Requests time out after 90 s.

Other scripts: `npm run build`, `npm start`, `npm run lint`.

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_API_BASE_URL` | browser + server | API base, e.g. `https://baytna-api-z7v9.onrender.com/api/v1`. Defaults to staging. The **only** public variable. |
| `DEV_OTP_KEY` | server, **dev only** | Lets the login screen fill in the OTP during development. Never set it on Vercel. |

`.env.local` is gitignored (`.env*`); only `.env.example` is committed.

### Dev OTP key

Put the key in `.env.local` as `DEV_OTP_KEY=<64 hex chars>`, with no quotes or
angle brackets, then restart `npm run dev`. The OTP screen then shows a
"Fill code (dev)" button.

How it stays out of production:

- The helper route is `app/api/dev/otp/route.dev.ts`. `next.config.ts` adds the
  `dev.ts` page extension **only** in the `next dev` phase, so the route isn't
  compiled into production builds at all. Check `next build`'s route table.
- The button is guarded by `process.env.NODE_ENV !== "production"`, which is
  constant-folded out of the client bundle.
- The key is read server-side only and is sent only to the backend's
  `/dev/last-otp`.

## Structure

```
app/
  layout.tsx                 <html lang="ar" dir="rtl">, font, providers
  providers.tsx              I18nProvider + QueryClient (retry only transient errors)
  login/                     country → phone → OTP
  (admin)/                   route group; everything here requires an ADMIN session
    layout.tsx               AdminGate + AppShell
    error.tsx, loading.tsx   boundaries for admin pages
    dashboard/               GET /admin/console/dashboard
    workers/                 queue (list) and [id] (detail + review)
  api/
    auth/{otp/request,otp/verify,refresh,logout}/route.ts   auth proxy (refresh cookie)
    documents/view/route.ts  fetches a document server-side for the viewer
    dev/otp/route.dev.ts     dev-only OTP helper (not in production builds)
proxy.ts                     redirects to /login when there's no session cookie
lib/
  env.ts                     public config, timeouts
  api/
    envelope.ts              THE place that knows { success, data, meta } / { success:false, error }
    errors.ts                ApiError (kind: http | network | timeout | session)
    client.ts                api.get / getPage / post / postForBlob
    activity.ts              slow-request tracking → "waking up" banner
    types.ts                 hand-written API types (see "API types")
  auth/                      in-memory session store, single-flight refresh, login actions
  server/                    server-only: backend fetch, cookie, role check
  i18n/                      dictionaries (ar is the source of truth), useT, localized(), formatters
components/
  ui/                        primitives: button, badge, table, pagination, modal, field,
                             skeleton, ltr, states (empty / error / waking banner / card)
  shell/                     AdminGate, AppShell (sidebar + header)
features/
  <area>/                    queries.ts (keys, hooks, mutations) + area-specific components
```

## How auth works

- Login is phone + OTP via `/api/auth/otp/*`, which proxy the backend.
  `verify` checks `user.roles` for `ADMIN` **before** issuing anything. For a
  non-admin it revokes the tokens the backend just issued and answers 403
  `NotAdmin`.
- The **refresh token** lives only in an `httpOnly`, `SameSite=Strict`,
  `Secure` (in production) cookie, `baytna_rt`. Browser JavaScript never sees it.
- The **access token** (15 min) is held in memory only: no localStorage, no
  cookie. A page load re-establishes it via `POST /api/auth/refresh`, which
  also re-checks the ADMIN role.
- **Single-flight refresh.** The backend revokes every session for the user if
  two refreshes present the same token. `lib/auth/refresh.ts` shares one
  in-flight promise per tab and serialises across tabs with the Web Locks API.
  Requests issued during a refresh wait for it; a request rejected with 401 is
  replayed once after refreshing. A definitive refresh failure logs out to
  `/login?reason=expired`. A transient failure (server asleep, network) does
  not log out.
- The auth routes also reject cross-site requests (`Sec-Fetch-Site` / `Origin`).

## Document viewing

Worker documents are national-ID photos and criminal-record certificates. Rules:

- A document is fetched **only** from the admin's click on "View", never in an
  effect and never ahead of time. Each fetch makes the backend issue a presigned
  URL and write an audit entry, so a prefetch would forge an access record.
- `POST /api/documents/view` gets the presigned URL **and** the bytes
  server-side, so the URL never reaches the browser (no history, cache,
  devtools or link). The response is `no-store`.
- The browser renders from memory: PDFs with pdf.js onto `<canvas>` (no native
  viewer toolbar, so no download or print button), images via a `blob:` URL
  that is revoked on close. Closing the dialog drops everything.
- There is no download button, no new-tab link, and no `<iframe>`, `<embed>`
  or `<a>` in the viewer. Context menu and drag are suppressed (a deterrent,
  not a guarantee).
- Non-HTTPS presigned URLs are refused (see Backend gaps).
- Nothing here logs tokens, URLs or document metadata.

## Conventions for adding a screen

1. **Types.** Add response types to `lib/api/types.ts`, taken from the live API
   (Swagger documents request bodies, not responses). Declare only the fields
   the screen reads. No `any`.
2. **Queries.** Create `features/<area>/queries.ts` with a key factory
   (`xKeys.all / list(params) / detail(id)`), `useQuery` hooks using
   `api.get` / `api.getPage`, and mutations that invalidate everything they
   can change: lists, detail, and dashboard counts.
3. **Page.** Add `app/(admin)/<area>/page.tsx`. The route group already
   enforces the session and role. A page using `useSearchParams` or
   `useParams` wraps its client component in `<Suspense>`. Keep filters and
   page numbers in the URL.
4. **States.** Every data view handles loading (`Skeleton` / `TableSkeleton`),
   error (`ErrorState` with retry) and empty (`EmptyState`).
5. **Strings.** Add keys to `lib/i18n/messages/ar.ts` first, then `en.ts`. The
   `Messages` type makes a missing English key a type error. No hard-coded
   user-facing text. Resolve backend `{ar, en}` text with `localized()`.
6. **RTL.** Use logical utilities (`ms-`, `pe-`, `start-`, `text-start`,
   `border-e`), never `left`/`right`. Wrap phone numbers, IDs and codes in
   `<Ltr>`.
7. **Nav.** Flip the item to `ready: true` in `components/shell/app-shell.tsx`,
   and make any matching dashboard tile a link.

## API notes (confirmed against staging)

- Envelope: `{ success, data }` or `{ success: false, error: { statusCode, message, error } }`.
  `message` is a string or an array of strings. Paginated endpoints add
  `meta: { page, limit, total, totalPages }` **beside** `data`; use
  `api.getPage`.
- `limit` is capped at 100 (higher → 400).
- `GET /cities` requires `countryId`, so cities are loaded per active country.
- OTP: requesting again too soon → 429 "Please wait before requesting another code".
- Review endpoints check that the worker or document exists before validating
  the body.

## Backend gaps

Found while building this. They need fixing on the backend; the console does
not paper over them.

1. **No worker name or phone.** `GET /admin/workers`, `GET /admin/workers/:id`
   and `GET /admin/console/workers/:id/360` return no name or phone for the
   worker, only `userId`. An admin reviewing the queue can't tell who she is
   reviewing. The console shows profile ID, city, bio, experience and dates,
   with an on-screen notice. Fix: embed `{ firstName, lastName, phone }` from
   the user in these responses.
2. **Presigned document URLs are `http://`.**
   `GET /admin/workers/:id/documents/:docId/url` returns `{ url, expiresInSeconds }`
   where `url` is plain HTTP on a storage host. Fetching an identity document
   over HTTP exposes it in transit, so the console refuses it, and **documents
   cannot be viewed until the backend issues HTTPS URLs**.
3. **Corrupted Arabic seed data.** The approved test worker's `bio.ar` is
   literally `"????? ??????"`: the Arabic was lost when the data was written.
4. **Approval doesn't require approved documents.** The staging worker is
   `APPROVED` while all three of her documents are still `PENDING`. If
   approval should require approved documents, the backend must enforce it.
   The console only warns.
5. **No submission timestamp.** Worker profiles have `createdAt` / `updatedAt`
   / `reviewedAt` but no `submittedAt`, so the queue can't sort or show "waiting
   since".
6. **CORS reflects any origin.** Preflights from arbitrary origins get
   `Access-Control-Allow-Origin: <that origin>`. Tokens aren't cookies, so
   this isn't directly exploitable from here, but it should be an allowlist.

## Deploying to Vercel

- Set `NEXT_PUBLIC_API_BASE_URL`. Do **not** set `DEV_OTP_KEY`.
- The auth and document routes set `maxDuration = 60` to survive a cold backend.
- The browser calls the API directly, so the API's CORS must allow the Vercel origin.
