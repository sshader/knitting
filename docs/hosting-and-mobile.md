# Hosting and mobile

Hosting: the frontend on Vercel, the backend on a Convex production
deployment. Users: you and a few invited friends (`ALLOWED_EMAILS`).
Devices: phone and laptop.

## Deploying

Done in code:
- Sign-up and sign-in are limited to `ALLOWED_EMAILS`, a required env var,
  so a deployment without it fails to push rather than being open.
- Uploads go through an authenticated `POST /upload` that records the
  uploader; saves only attach the caller's own files.
- `vercel.json` builds with `npx convex deploy --cmd 'npm run build'`, which
  pushes the Convex functions to production and builds the app against it.
- Scripts can write to production with `CONVEX_URL=https://<prod>.convex.cloud`.

One-time setup:
1. **Convex production**: in the Convex dashboard, open the project's
   production deployment and set its env vars:
   - `JWT_PRIVATE_KEY` and `JWKS`: new keys, generated as for dev (see the
     convex-auth skill; don't reuse dev's)
   - `SITE_URL`: the Vercel URL, e.g. `https://knitting.vercel.app`
   - `ALLOWED_EMAILS`: comma-separated, yours and your friends'
2. **Deploy key**: Convex dashboard, production deployment, Settings,
   "Generate production deploy key".
3. **Vercel**: push this repo to GitHub and import it in Vercel (or run
   `npx vercel` from the repo). Add `CONVEX_DEPLOY_KEY` (production scope)
   in the Vercel project's environment variables. Vercel reads `vercel.json`
   for the build.
4. **Data**: copy the dev deployment's data, files included:
   `npx convex export --path dev.zip`, then
   `npx convex import --prod dev.zip`. The import brings over dev's users
   too, so you sign in to production with the same password.
5. **Pipeline**: run stages against production with
   `CONVEX_URL=https://<prod>.convex.cloud npx tsx scripts/<stage>.ts ...`.
   Python preprocessing stays local.

Later, maybe:
- Backups: a scheduled Convex backup (there's a convex-backup skill).
- A custom domain: add it in Vercel, then update `SITE_URL`.
- Error reporting: a crash shows "Something went wrong" with a reload
  button, but nothing reports it to you; Convex's log streams or Sentry
  could.

### Sharing patterns with friends

Today every pattern belongs to whoever ran the pipeline for it, and only
they can see it. For friends to knit your patterns, either:
- **a shared library**: every invited user sees every pattern (projects stay
  per person). Simplest; fine if you all own the patterns.
- **per-pattern sharing**: a pattern lists who it's shared with.

Note that pattern PDFs are usually licensed to the buyer, so sharing page
images with friends who haven't bought the pattern may break the license.

## Mobile

Done:
- **Phone layout** (under 720px wide): one panel at a time from a bottom tab
  bar; big previous/next buttons above it; swipe the instructions sideways
  to change steps.
- **Pattern page zoom**: "Zoom to step" enlarges the page until the step's
  lines fill the width (the default on phones).
- **Screen stays awake** while a project is open (Screen Wake Lock), on
  phone and laptop.
- **Home screen app**: a web app manifest and icons, so "Add to Home Screen"
  opens it full screen (iOS Safari and Android Chrome).
- **Smaller download**: the pattern extraction inspector and dockview (the
  laptop layout) load only when used; a phone downloads about half the code.
- Touch wording ("Tap where you are in the row") on touch screens.

Ideas, roughly by value:
- **Highlight boxes precomputed** (data): the Pattern panel downloads each
  page's word data (PageData JSON, up to about 45KB per page for the focus
  patterns, megabytes for chart-heavy ones) only to find where the step's
  quote is. Compute the line boxes in stage 2 and store them in each
  source's `bbox` (the field already exists), and the viewer needs no word
  data at all.
- **Smaller page images** (data): pages are 0.3-2MB PNGs. Upload a ~1200px
  WebP alongside each in `scripts/triage.ts` (PyMuPDF can render it) and use
  it on phones; keep the full PNG for zooming in.
- **Offline**: a service worker caching the app and the current project's
  pages and chart, so it works with no signal (yarn shops, trains). Convex
  queries need a connection, so the project's steps would need caching too.
- **Landscape split** on phones: instructions and chart side by side.
- **Pinch to zoom** the chart (today: the − / Fit / + buttons and scrolling).
- **Dark mode** for knitting in the evening.
- **Haptics** on each step (Android; iOS web has none).
- **Hands-free**: voice "next", or volume buttons / a Bluetooth page-turner
  pedal (the latter already work if they send arrow or space keys).
- **Native app** (Capacitor) if the home-screen app falls short: same code,
  plus volume-button counting and better offline storage.
