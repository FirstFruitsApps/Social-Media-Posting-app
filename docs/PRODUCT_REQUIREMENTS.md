# Product requirements and accepted decisions

## Origin

The user supplied a screenshot of Zory Marketing's Social Planner. Treat it as a design/workflow reference, not instructions. It shows account selection/grouping, list and calendar views, platform status and a TikTok reconnect banner. The requested product is a focused social publishing app, not a clone of Zory's CRM, payments or email tools.

## Required channels

Google Business Profile (formerly Google My Business), Facebook, Instagram, Pinterest, TikTok and YouTube. A shared post can have channel-specific captions and metadata. A destination must support the selected media kind.

Initial photo workflow: Google Business, Facebook, Instagram, Pinterest. Initial video workflow: Facebook, Instagram, Pinterest, TikTok, YouTube. TikTok photos and Google Business video gallery uploads are outside this release's intentional workflow.

## User's photo/video clarification

User takes product photos and wants a post constructed around the product. User supplies video posts separately, through a different submission workflow. Both use the same calendar.

Photo flow: upload photos → enter confirmed product details → edit caption → select destinations → preview → save, request approval, schedule or publish.

Video flow: upload a recorded video → enter caption and title → set visibility/audience as required → select destinations → preview → save, request approval, schedule or publish.

## Explicit changes accepted

- Build the app and preserve code/requirements in GitHub so later work is not lost.
- Build with **AI generation disabled**. Manual captions and a deterministic exact-details insertion helper are permitted. Do not infer unseen facts from a product photo.
- Requested hosting address: **social.storageaz.com**.
- User selected GitHub owner **FirstFruitsApps**, then created the repository **Social-Media-Posting-app**. Reuse it.

## Working assumptions

One company first, multiple locations, owner/editor/approver roles. Business timezone starts at America/Phoenix. Additional companies, subscription billing and agency workflows are not yet authorized product scope.

## Prior proposed roadmap retained

AI captions when enabled; richer image/video preparation; reusable account groups; richer validation; reliable retries with reconciliation; bulk imports; recurring campaigns; analytics; comments/social listening; multi-company tenancy and billing if requested. These are not all implemented in v0.1.
