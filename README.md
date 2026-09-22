# Storage Social

A working, self-hosted social publishing workspace for Advanced Storage. Product photos and video posts have separate creation flows and share a planner. **Optional AI caption suggestions require an OpenAI API key and owner opt-in.**

Production address: **https://social.storageaz.com** (live on Hostinger Web Apps)

GitHub repository: **https://github.com/FirstFruitsApps/Social-Media-Posting-app**

## Current release

- Separate photo and video upload/composer workflows; drag-and-drop and media library reuse.
- Product details, manually written captions, per-platform captions, live approximate previews.
- Non-AI helper inserts the exact product details you supply; never invents product claims.
- Optional photo-to-caption assistant with review before use, platform variants, and an estimated monthly allowance. See [AI setup and usage](docs/AI.md).
- Photo reordering and a crop tool that saves a separate JPEG copy while preserving originals.
- Persistent drafts, revision conflict detection, duplicate/archive, search/status filters.
- List and monthly calendar, IANA time zones, daylight-saving validation, scheduled dispatch.
- Optional approval workflow, owner/editor/approver roles, server-side login in production.
- Durable SQLite database, streamed local media uploads, video range requests.
- Full database/media backup download and tested restore command; JSON post export.
- Optional Upload-Post adapter for connection links, destination lookup, uploads and status polling.
- Per-destination delivery state and idempotency identifiers. Ambiguous uploads are polled, not blindly re-sent.

**This release is not yet connected to real social accounts.** It does not simulate successful publication. Drafting, uploads, scheduling and backups work without a provider. When a scheduled post becomes due without publishing configuration, it moves to Needs attention. Live publication requires a configured Upload-Post account/API key, an existing profile linked to a location, and authorized social accounts. No subscription was purchased.

Production hosting and DNS were activated and verified on September 21, 2026. GoDaddy routes the `social` hostname to the Hostinger Web App. HTTPS and owner sign-in were tested at the production address. The current deployment was uploaded directly to Hostinger, so source changes in GitHub must be packaged and redeployed manually; see `docs/DEPLOYMENT.md` and `docs/HANDOFF.md`.

## Run locally

Requires **Node.js 24 or newer**. There are no third-party runtime dependencies or frontend build steps.

```sh
git clone https://github.com/FirstFruitsApps/Social-Media-Posting-app.git
cd Social-Media-Posting-app
node src/server.mjs
```

Open **http://127.0.0.1:3080**. Default development mode is restricted to loopback and offers an explicitly labeled local-owner preview. Never expose development mode through a public tunnel. Production always uses real user authentication.

Optional: copy `.env.example` to `.env`, configure it, then use:

```sh
node --env-file-if-exists=.env src/server.mjs
```

`npm start`, `npm run dev`, `npm test`, `npm run check` and `npm run backup` are convenience aliases when npm is installed. No package install is necessary.

## Validate

```sh
node scripts/check.mjs
node --test tests/*.test.mjs
```

Tests use isolated temporary directories and local mock provider behavior, never real social posts. They cover authentication, CSRF/origin protection, uploads, range reads, input validation, revision conflicts, scheduling, persistence across restart, backup/restore, time zones and publication-status interpretation.

## User guide

The eight-page plain-language guide is available inside the live app under **Settings → Simple user guide**. Pages 7-8 explain how to replace the OpenAI API key before it expires, test the replacement and revoke the old key. It can also be opened at `/storage-social-user-guide.pdf` on any deployed app address. Rebuild it with `python scripts/build_user_guide.py` (documentation-only dependency: ReportLab).

## Back up the actual business data

Git preserves source, documentation and version history. It **does not** preserve the live database, photos/videos, passwords or API credentials. Those are intentionally ignored.

Use Settings → Download full backup, or:

```sh
node --env-file-if-exists=.env scripts/backup.mjs
node scripts/restore.mjs backups/YOUR_BACKUP.tar NEW_EMPTY_DATA_DIRECTORY
```

Stop the application before changing DATA_DIR to the restored directory. Keep full backups private: they contain user password hashes and sessions as well as media. Set up an off-server daily backup before using the production app for irreplaceable work. Test restore periodically. Provider credentials are environment secrets and must be backed up separately in a password manager.

## Continue development

Read **docs/HANDOFF.md** first, then **docs/PRODUCT_REQUIREMENTS.md**, **docs/ARCHITECTURE.md** and **docs/ROADMAP.md**. `AGENTS.md` records the decisions future coding sessions must preserve. See `docs/INTEGRATIONS.md` for the documented publishing adapter and outstanding live validation.

## Scope and limitations

This is a single-company application with multiple location profiles. It is not an agency multi-tenant service. The deployment uses one application process and a persistent local disk; scaling to multiple replicas requires a database/worker redesign. Live provider behavior, real-account OAuth, and platform-specific media constraints still need account-based acceptance testing. Automatic retransmission after a confirmed failure is intentionally not enabled yet. Recheck uncertain outcomes in the provider dashboard before deciding to duplicate a failed post. Email invitations, self-service password reset, advanced analytics and social inboxes are future work.

No license granting public reuse has been selected. The repository visibility is controlled by the owner.
