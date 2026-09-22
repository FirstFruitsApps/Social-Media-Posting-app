# Optional AI caption assistant

## Setup

1. Create an OpenAI Platform API key and enable API billing/credits. ChatGPT subscription billing is separate.
2. Store `OPENAI_API_KEY` in Hostinger environment variables. Never put it in GitHub, the browser app, or a source ZIP.
3. Deploy this release. In Storage Social Settings, enable AI captions and save the AI settings.
4. The default monthly allowance is $10 and the maximum is 100 attempts per UTC month. Owners can set the allowance from $1 to $50.

This release uses `gpt-5.6-terra` with low reasoning effort through the Responses API. Account/model access and credit balance still require a live check. No generation happens just by opening the app or enabling the setting.

## Create a photo post

Upload your real product photos, enter the product name and confirmed features under Product details, and select destinations. Add price, offer, and a product link when known. Choose **Draft with AI**, optionally describe your preferred tone, and choose **Send to OpenAI & draft**.

OpenAI receives the first three selected photos (20 MB total maximum), company/location name, supplied product facts, link, notes, and selected destinations. The UI explains this before submission. Original media stays unchanged. More than three photos can remain in the post; only the first three inform AI captions.

Review the shared caption, each platform caption, and facts to check. **Use suggestions** replaces the shared and selected platform captions in the unsaved composer. It fills an empty post name but preserves an existing one. Save your draft, then use the normal review/schedule/publish process. **Discard** leaves your caption unchanged. AI output may contain mistakes, so check prices, availability and claims.

## Video posts

Keep using the separate video upload flow. The assistant can draft captions from confirmed product details and your written video description. It does not watch, send, edit or generate the video. Image and video generation are outside this release.

## Cost controls and error handling

The app permits one AI request at a time and up to 10 attempts per user per 15 minutes. A persistent ledger enforces 100 provider attempts per UTC month and reserves $0.25 against the monthly allowance before each attempt. Successful responses reconcile that reserve using reported tokens and standard Terra rates ($2 input / $12 output per million tokens, cached discounts ignored). Rate changes require updating this calculation.

Timeouts, interrupted requests, and missing usage keep the reservation because a provider charge may have happened. Confirmed HTTP rejections release it but still count as attempts. The ledger survives restarts and full backups. Duplicate completed request IDs return the existing result instead of making another paid call. No automatic retries are performed.

The allowance is an **application estimate**, not an OpenAI billing guarantee or account-wide spending cap. Check actual charges and credit settings in OpenAI Platform. Other applications using the same account can incur their own charges. Refusals, incomplete output, invalid captions and billing errors never replace existing draft text or trigger publishing.

## Verification

`node scripts/check.mjs` and `node --test tests/*.test.mjs` cover disabled/keyless behavior, request privacy, mock successful generation, idempotency, invalid inputs, concurrency, budget persistence, uncertain requests, billing failures, output validation, authorization, and monthly attempt limits. Mocks use no real key and incur no provider charges. Live model and billing validation must be recorded separately in HANDOFF.md.
