# Remaining work

## Launch operations

- [ ] Select/access the hosting target and configure persistent disk.
- [ ] Create the production owner credential securely.
- [ ] Deploy and verify social.storageaz.com and HTTPS.
- [ ] Configure daily off-server backups and verify restoration from an off-server copy.
- [ ] Configure the selected social publishing service; obtain/authorize the actual company accounts.
- [ ] Run explicitly approved live publishing acceptance tests for all six destinations.

## Provider hardening

- [ ] Verify account and destination response schemas against the actual connected accounts.
- [ ] Enforce current media dimensions, duration and size rules before dispatch.
- [ ] Retrieve and enforce current TikTok creator choices/interaction restrictions and disclosure requirements on the server.
- [ ] Confirm identity changes after reconnection before sending queued content to a replacement account.
- [ ] Add recheck and provider-supported failed-destination retry actions without repeating successful destinations.
- [ ] Add owner notifications for failed posts and expired connections.
- [ ] Add configurable late-post handling after prolonged server downtime.

## Product improvements

- [ ] Custom video thumbnails and caption/subtitle uploads.
- [ ] Saved account groups, asset tags, richer search and optional per-platform asset selection.
- [ ] Offer/event templates for Google Business.
- [ ] Owner-driven password reset and account deactivation; email invitation flow if requested.
- [ ] AI drafting only after the user explicitly enables it.
- [ ] Analytics, bulk import, recurring campaigns and additional companies if requested.

The initial conversation proposed a 7–12 week small-team build for a fully tested production service. This repository is a functional first release and continuation point; it does not claim that all proposed features or real-account launch verification are complete.
