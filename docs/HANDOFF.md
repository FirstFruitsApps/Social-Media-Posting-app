# Start here next time

## User decisions

Build the social posting app from the agreed plan. Keep photo and video submission separate. AI generation is disabled. Preserve the work in **FirstFruitsApps/Social-Media-Posting-app**, which the user created. Production hostname must be **social.storageaz.com**.

## Implemented

Functional manual photo/video composer, persistent media library, crop-to-JPEG copies, platform captions and previews, drafts, editing/revision checks, duplication/archive, list/calendar, timezone scheduling, optional approvals, role-based production login, company/locations, conservative publishing adapter, per-platform statuses, audit, full backup and tested restore.

Node 24 built-ins only. Start with `node src/server.mjs`. Development binds to 127.0.0.1:3080. Production must use HTTPS APP_ORIGIN, NODE_ENV=production and an owner account. Source is designed to deploy via included Docker/Caddy or another persistent Node host.

## Validation

Run `node scripts/check.mjs` and `node --test tests/*.test.mjs`. Automated integration checks exercise real local HTTP/file/database paths and a complete backup restore. They do not send real social posts. Browser testing checks the planner and composer workflow. See later verification notes in this document for final results.

## Operational status

- Application source, deployment configuration and tests are saved in FirstFruitsApps/Social-Media-Posting-app. This handoff and the remaining documentation accompany that source.
- Requested repository was observed to be public when the user created it. Do not change visibility without the owner's instruction.
- No AI key is needed or used.
- No publishing provider account/API key is configured. No live social accounts were connected or posted to.
- No hosting target/access has been supplied. DNS lookup points to GoDaddy nameservers; social.storageaz.com is not activated by this session.
- Local source folder is outputs/storage-social in the originating task workspace.
- Original screenshot remains in the conversation; it was not copied into the repository.

## Important continuation rules

Never pretend pending OAuth, DNS or provider setup has completed. Never upload credentials or business data to the public repository. Keep source backup separate from data backups. Continue actual hosting setup when the user provides access, then validate provider integration against the real accounts. Preserve all root-domain website and mail records.

## Verification notes — September 21, 2026

Syntax checks and all nine automated tests passed. Browser checks passed for photo upload, crop-to-JPEG, draft saving, scheduling and separate video metadata controls. The QA post was archived. No live publication occurred. Docker deployment and real-account publishing still require acceptance testing.
