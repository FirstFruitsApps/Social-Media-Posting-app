# Deploy at social.storageaz.com

## Preconditions

The hostname was requested by the user. It is not activated simply by saving code in GitHub. Choose an existing Node-capable host or a small VPS with persistent disk. Static-only hosting/GitHub Pages cannot run this backend. The user has not yet provided hosting access or a confirmed hosting target.

Public DNS inspection during this session returned `ns51.domaincontrol.com` and `ns52.domaincontrol.com` for storageaz.com, consistent with GoDaddy DNS. Confirm ownership/control in the domain account before changing records. No DNS records have been changed by this project.

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

No server has been provisioned, no credentials configured, no DNS changed, and no certificate issued by this development session. Domain activation requires access to the chosen host and DNS account.
