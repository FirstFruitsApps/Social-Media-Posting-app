# Publishing integration

## Implemented adapter (requires configuration and live validation)

Upload-Post is an optional provider, not a purchased or connected service. It offers a documented common API for the six requested platforms. It can be replaced behind the provider interface if the business chooses another service.

Set UPLOAD_POST_API_KEY in the server's secret environment. Create a provider user profile in its dashboard, then put that profile's username on the corresponding app location in Settings. Use Social accounts → Connect account to open its secure hosted OAuth connection page. Account access, subscription costs, platform permissions and supported use cases must be confirmed with the service before production use.

The app does not currently provision paid accounts, create provider profiles or purchase subscriptions. No real provider requests or social posts were made during development.

## API contract used

- Authorization: `Apikey <secret>`.
- List profiles: GET `/api/uploadposts/users`.
- Account connection URL: POST `/api/uploadposts/users/generate-jwt`.
- Destination lookups: Facebook Pages, Pinterest boards, Google Business locations, TikTok settings.
- Photos: POST `/api/upload_photos`; videos: POST `/api/upload`.
- One destination per request; multipart original assets; per-destination caption/title/metadata.
- Explicit `request_id`, `external_id`, `Idempotency-Key`, `async_upload=true`.
- Status: GET `/api/uploadposts/status?request_id=...`.
- TikTok inbox fallback disabled on upload; any returned inbox flag is still treated as manual action, never Published.

Reference pages reviewed during implementation:

- https://docs.upload-post.com/api/user-profiles/
- https://docs.upload-post.com/api/upload-photo/
- https://docs.upload-post.com/api/upload-video/
- https://docs.upload-post.com/api/upload-status/
- https://docs.upload-post.com/api/reference/
- https://developers.tiktok.com/docs/en/content-sharing-guidelines
- https://developers.google.com/my-business/content/posts-data
- https://developers.google.com/youtube/v3/docs/videos/insert

## Acceptance before live operation

1. Confirm provider supports this company-only use case, all six destinations, desired formats and the plan's volume.
2. Connect actual test accounts with explicit authorization. Confirm the exact Page/channel/location/board identities.
3. Confirm provider response shapes for profiles, destination lists and TikTok settings using actual accounts; fix the adapter for verified differences.
4. Submit one explicitly approved test photo/video per destination and verify published link, caption, visibility and media.
5. Verify account reconnect, revoked tokens, media processing errors, quota failures and post-crash request reconciliation.
6. Add richer server-side media dimensions/duration checks and enforce TikTok's current creator settings before enabling broad unattended TikTok publishing. The current adapter is not represented as an independently audited TikTok client.
7. Implement an explicit failed-delivery retry flow using the provider retry API only after verifying its current contract. Current release prioritizes avoiding duplicate live posts over automatic recovery.

Limits in the UI are deliberately conservative application limits, not an exhaustive or permanent statement of platform capabilities. Provider/network-specific validation can still reject media. Custom thumbnails, Stories, native music selection, Google offers/events and account groups require additional work.
