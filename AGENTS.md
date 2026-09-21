# Instructions for future work

Read docs/HANDOFF.md before modifying this application. The user requested a real social publishing application and continuity through GitHub, not a marketing landing page.

- Repository: FirstFruitsApps/Social-Media-Posting-app. Do not create another repository.
- Production hostname: social.storageaz.com. Never change storageaz.com's root website or mail records to deploy this app.
- AI generation is explicitly DISABLED. Do not add an OpenAI dependency, key requirement, AI-generated captions or paid AI calls unless the user later enables them.
- Preserve two distinct entry points: Create photo post and Create video post. They share one planner and media library.
- Never mark a post Published merely because an upload request succeeded. Interpret each platform result, processing, skipped platforms and TikTok inbox fallback separately.
- Preserve original uploaded media. Cropping creates a new JPEG asset.
- Never commit .env, real data, session tokens, API keys, user-uploaded media or full business backups.
- Repository source history is not a database/media backup. Maintain the tested export/restore workflow.
- Current backend is Node 24 built-ins, SQLite and local file storage. No dependency install or build is needed. Retain this portability unless a requested change requires migration.
- Development auto-owner access is loopback-only. Production must require authentication; never disable it to simplify deployment.
- Read docs/INTEGRATIONS.md before changing provider behavior; validate current official docs and real-account responses.
- Run `node scripts/check.mjs` and `node --test tests/*.test.mjs` for relevant changes. Never publish live social test posts without a specific approved test plan.
- Use one application process per data directory. Preserve scheduler intent records and conservative uncertain-result handling.
- Update docs/HANDOFF.md with actual completed work, verification and blockers at the end of a work session. Do not call untested integrations production-ready.
