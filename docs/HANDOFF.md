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
- Hostinger contains OPENAI_API_KEY and UPLOAD_POST_API_KEY environment entries as of September 22. Secrets are not committed to this repository. Billing and live social connections must be verified separately.
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

The release was saved in GitHub and deployed to Hostinger on September 22. Browser assets now have a release version in index.html to avoid stale cached UI. AI captions are enabled with the default $10 estimated allowance. The first live text-only test was rejected because API billing was unfunded. After the owner funded billing, a second test successfully generated a shared caption, a Facebook variant and review notes using gpt-5.6-terra. Applying suggestions populated the unsaved composer correctly. The test was discarded without saving or publishing. The refreshed usage ledger showed two attempts and approximately $0.002 estimated spend. Live photo-input generation has not been tested; image handling is covered by local mock tests.

Deployment verification uncovered that Hostinger replaces code-relative data on redeployment. The original full backup (zero posts/media, one owner) was restored to a private `storage-social-data` folder beside `hbuilds` and `public_html`. Hostinger DATA_DIR now points to its absolute path; preserve that setting. The original owner ID was verified restored. Business backups remain private, outside this source repository. The temporary draft "AI connection check — do not publish" was created only to verify persistence.

A second redeployment with the persistent DATA_DIR preserved the owner session, enabled AI setting, $10 allowance, one-request usage ledger and test draft. The test draft was then archived; none were scheduled or published. The OpenAI key metadata showed an October 22, 2026 expiration date; renew it through the owner's secure key workflow before expiry. Live API generation was subsequently verified successfully after the owner funded billing.

GitHub changes were saved through the FirstFruitsApps browser session because the connector has no write permission and terminal push did not complete. The source archive is `storage-social-ai-captions-release.zip` in the parent outputs directory. HTTP checks confirmed the private database paths return 404 and unauthenticated bootstrap returns 401. Future asset edits must change the version in public/index.html.

## Updated owner guide

The user requested simple API-key replacement instructions in the existing app PDF. The guide is now eight pages, with the replacement checklist on pages 7-8, dated key-expiry information, create/install/test/revoke order, DATA_DIR preservation, troubleshooting, and clickable provider links. Earlier AI-disabled wording was corrected. `scripts/build_user_guide.py` keeps the ReportLab source reproducible; ReportLab is not an app runtime dependency. Rendered pages were visually checked. No key was created or replaced for this documentation task.
