# Architecture

## Runtime

Node.js 24+ using built-in HTTP, SQLite, crypto, streams and fetch. Browser UI is native ES modules, semantic HTML/CSS and native dialog controls. No frontend compilation and no npm dependencies. The repository is deployable on a persistent Node host or via Docker/Caddy.

## Modules

- `src/server.mjs`: HTTP API, authentication enforcement, uploads/static serving, application bootstrap.
- `src/db.mjs`: SQLite schema, settings, audit and post materialization.
- `src/domain.mjs`: media/channel rules, post normalization, readiness validation, delivery aggregation.
- `src/auth.mjs`: salted scrypt password hashes, hashed persistent session tokens, owner bootstrap.
- `src/provider.mjs`: optional Upload-Post adapter. API secret stays server-side in environment.
- `src/scheduler.mjs`: durable outbox, one process, background dispatch and status polling.
- `src/backup.mjs`: consistent SQLite snapshot plus streamed tar of immutable media.
- `public/app.js`: planner, composers, library, connections, approvals and settings.
- `public/time.js`: wall-time conversion with DST gap/ambiguity rejection.

## Data model

One workspace setting contains company details, IANA timezone and locations. A location maps to a provider profile. A post stores shared caption, product facts, media IDs, platform captions, metadata and location. Destinations receive individual delivery rows with a unique `(post_id, platform, profile)` constraint. Immutable media files use generated IDs; user filenames never become filesystem paths. Audit entries record meaningful mutations.

State flow: draft → pending_approval → approved → scheduled → publishing → published / partial / needs_attention. Approval is optional. Editing an approved post returns it to draft. Scheduled posts must be returned to draft before editing. Posts with existing delivery attempts cannot be edited or automatically resubmitted. Duplicating creates an unscheduled draft with no delivery history.

## Scheduling and failure behavior

Dates are stored as ISO UTC and shown in the workspace timezone. The scheduler scans every 10 seconds while the service is running. Due work is persisted before provider network requests. Each destination is independent. A known request ID and idempotency key allow post-crash reconciliation. Processing polls back off to 30–60 seconds. Unknown outcomes remain unconfirmed; after a bounded period they need operator attention. Never repost blindly. Missed dates are processed when the service restarts; operators must cancel stale offers before restarting after prolonged downtime.

## Security boundaries

Development bypass requires a loopback bind and peer. Production uses HttpOnly/Secure/SameSite cookies, hashed sessions, CSRF tokens, strict origin/Host checks, login rate limiting and server-enforced roles. Serve production behind TLS with APP_ORIGIN matching the exact public hostname. Backend APIs cannot be called through unrelated origins. User-controlled rendered strings are escaped. Production secrets are never included in browser bootstrap responses or source control.

Single company, not multi-tenant. One process per database; no horizontally scaled schedulers. Password resets currently require an owner operational procedure; do not expose local preview publicly.

## Durability

SQLite WAL holds structured records; `data/media` holds originals and JPEG crops. Data directory and credentials are excluded from Git and Docker build context. Backups include a SQLite online snapshot and media. Restore refuses non-empty targets and unsafe archive names. GitHub holds source and planning artifacts, not live data. Keep off-server backups and restore drills.
