# Deploy at social.storageaz.com

## Preconditions

Current production status as of September 21, 2026: **https://social.storageaz.com** is live on Hostinger Web Apps. It runs Node.js 24 with `src/server.mjs` as the entry file. Hostinger holds the production environment variables, and GoDaddy DNS has an A record for `social` pointing to the address assigned in Hostinger. Keep the exact address and account identifiers in the provider dashboards rather than this public repository.

The current release was deployed by uploading a source archive. This preserved the existing GitHub repository under FirstFruitsApps and avoided creating a second repository under another account. Automatic GitHub deployment is not connected.

## Redeploy the Hostinger Web App

1. Pull or download the latest commit from `FirstFruitsApps/Social-Media-Posting-app`.
2. Run `node scripts/check.mjs` and `node --test tests/*.test.mjs`.
3. Download a private full-data backup from Settings before changing the deployed release.
4. Create a source archive that excludes `.git`, `data`, `backups`, local `.env` files and dependencies.
5. In Hostinger Web Apps, redeploy by uploading the new archive. Keep Node.js 24, project root `./`, no build command and entry file `src/server.mjs`.
6. Preserve the existing environment variables and secrets. Never place the owner password or a provider API key in the repository or source archive.
7. Verify `https://social.storageaz.com`, owner login, the planner and one reversible draft after deployment. Do not create a live social post as a deployment test.

## Docker option for a dedicated server

The included compose file starts one Node app and a Caddy HTTPS reverse proxy. On an existing server already serving ports 80/443, integrate the app into that existing reverse proxy instead of starting a conflicting Caddy service.

1. Clone the GitHub repository onto the server.
2. Copy `.env.example` to `.env` and set:
   - `BOOTSTRAP_ADMIN_EMAIL` to the owner's chosen email.
   - `BOOTSTRAP_ADMIN_PASSWORD` to a unique password of at least 14 characters, using the host's secret manager where available.
   - `UPLOAD_POST_API_KEY` only when enabling the optional provider.
3. The compose file enforces production mode, an internal bind and `APP_ORIGIN=https://social.storageaz.com`.
4. Run `docker compose up -d --build` on the authorized host.
5. Add an **A record** for host **social** under storageaz.com pointing to that server's public IPv4 address. Add AAAA only if the server is correctly configured for IPv6. If the chosen hosting platform instead provides a CNAME, use its exact target for **social**; never invent a target.
6. Preserve all root, www and mail/MX records. Only modify the requested `social` hostname.
7. Allow TCP 80/443 to Caddy. Do not expose port 3080 publicly. Caddy obtains the TLS certificate after DNS points at it.
8. Verify HTTPS, sign-in and login-protected APIs at the actual hostname. Confirm that unauthenticated visitors cannot access media or business records.
9. Remove the bootstrap password from the service environment after the owner account is created, then restart. Bootstrap does not overwrite an existing owner.
10. Configure daily off-server backups of the full app data and a separate secret backup. Run a restore drill.

## Existing Node hosting option

Run `node --env-file-if-exists=.env src/server.mjs` with Node 24+, NODE_ENV=production and APP_ORIGIN=https://social.storageaz.com. Set HOST as required by the host, proxy the exact Host header, and mount DATA_DIR on persistent disk. Run exactly one instance and keep it running continuously for scheduled posts. Route the social subdomain to the host using its returned DNS record.

## Rollback

Back up the database/media before deploying a new version. Deploy a previous Git commit to roll back code. Never delete or overwrite the data volume to roll back code. Schema migrations must be reviewed for backward compatibility. For a data restore, stop the app, restore to a new empty directory using scripts/restore.mjs, verify integrity, then switch DATA_DIR.

## What is not yet done

The app is not connected to a publishing provider or real social accounts. Live publishing remains disabled until the provider API key, location profile and authorized destinations are configured and verified. Automatic deployment from the GitHub repository is also not enabled.
