# Start here next time

## User decisions

Build the social posting app from the agreed plan. Keep photo and video submission separate. The user authorized optional AI captions on September 22, 2026; AI images/videos and automatic publishing remain outside scope. Preserve the work in **FirstFruitsApps/Social-Media-Posting-app**, which the user created. Production hostname must be **social.storageaz.com**.

## Implemented

Functional manual photo/video composer, persistent media library, crop-to-JPEG copies, platform captions and previews, drafts, editing/revision checks, duplication/archive, list/calendar, timezone scheduling, optional approvals, role-based production login, company/locations, conservative publishing adapter, per-platform statuses, audit, full backup and tested restore.

Node 24 built-ins only. Start with `node src/server.mjs`. Development binds to 127.0.0.1:3080. Production must use HTTPS APP_ORIGIN, NODE_ENV=production and an owner account. Source is designed to deploy via included Docker/Caddy or another persistent Node host.

## Validation

Run `node scripts/check.mjs` and `node --test tests/*.test.mjs`. Automated integration checks exercise real local HTTP/file/database paths and a complete backup restore. They do not send real social posts. Browser testing checks the planner and composer workflow. See later verification notes in this document for final results.

## Operational status

- Application source, deployment configuration and tests are saved in FirstFruitsApps/Social-Media-Posting-app. This handoff and the remaining documentation accompany that source.
- Requested repository was observed to be public when the user created it. Do not change visibility without the owner's instruction.
- Hostinger contains masked OPENAI_API_KEY and UPLOAD_POST_API_KEY entries as of September 22. Their values were not read or committed. Key validity, billing and live social connections must be verified separately.
- Production is live at **https://social.storageaz.com** on Hostinger Web Apps using Node.js 24 and `src/server.mjs`.
- GoDaddy DNS has an A record for `social` pointing to the address assigned by Hostinger. Hostinger confirmed the domain connection and HTTPS is working. Keep the current address in the provider dashboards rather than copying it into this public repository.
- The owner account is configured. Its email and password are stored only in the hosting account and password manager and must never be committed to GitHub or copied into public documentation.
- The Hostinger deployment was made by uploading the source archive. Automatic GitHub deployment is not connected, so future source changes require a new package and manual redeployment.
- Hostinger showed daily backups as enabled. Continue downloading private full-data backups from the app and test restoration before relying on it for irreplaceable media.
- Local source folder is outputs/storage-social in the originating task workspace.
- Original screenshot remains in the conversation; it was not copied into the repository.

## Important continuation rules

Never pretend pending OAuth, DNS or provider setup has completed. Never upload credentials or business data to the public repository. Keep source backup separate from data backups. Continue actual hosting setup when the user provides access, then validate provider integration against the real accounts. Preserve all root-domain website and mail records.

## Verification notes — September 21, 2026

Syntax checks and all nine automated tests passed. Browser checks passed for photo upload, crop-to-JPEG, draft saving, scheduling and separate video metadata controls. The QA post was archived. Production returned HTTP 200 over HTTPS, and owner login reached the empty planner successfully. No live publication occurred. Real-account publishing still requires acceptance testing after a provider and social accounts are connected.

## AI caption release — September 22, 2026

Optional server-side OpenAI captions are implemented with owner opt-in, a default $10 monthly estimated allowance, 100 attempts per UTC month, persistent usage accounting and review before applying suggestions. Photo input uses the first three selected pictures plus confirmed facts; video input uses written details only. No automatic save or publication occurs. See AI.md for setup, privacy and cost details.

Syntax checks and all 17 automated tests passed without paid API calls. Local browser checks passed for the disclosure, generation with a mock provider, per-platform review, applying suggestions, saving a draft and disabling AI. This verifies app behavior, not live OpenAI model access or billing. Release deployment and any live verification will be recorded separately.

The tested source archive is `storage-social-ai-captions-release.zip` in the parent outputs directory. GitHub changes are being saved through the FirstFruitsApps browser session because the connector has no write permission and terminal push did not complete. Deployment is awaiting owner sign-in to the existing app so its current database/media can be backed up first. No live AI call or social publication has been performed.
