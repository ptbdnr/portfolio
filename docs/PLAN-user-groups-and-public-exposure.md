# Plan: User Groups, Restricted Content, and Public Exposure of the Portfolio Webapp

This document covers two things:

1. An implementation plan to add **3 user groups** (admin, regular user, privileged user)
   with public/restricted content to the portfolio webapp.
2. A **step-by-step guide** to expose the container running on the UGREEN NAS 4800 Plus
   to the internet via a Namecheap domain — no LAN access, no VPN required.

---

## Part 1 — User groups and access model

### 1.1 Current state

The app is a static Next.js 15 (App Router) portfolio: no authentication, no API routes,
no database. All three user groups require adding an auth layer, a persistence layer,
and per-content access control.

### 1.2 Roles and permissions

| Role | Who | Permissions |
|---|---|---|
| **Anonymous** | anyone on the internet | Read `public` content only. Cannot use chat. |
| **Regular user** | anyone signed in via Google or Microsoft (OAuth 2.0 / OIDC) | Read `public` content, use the chat. Cannot see `restricted` content. |
| **Privileged user** | a signed-in user whose email is on a content item's ACL | Everything a regular user can do, plus read the specific `restricted` content items they were named on (including via direct link). |
| **Admin** | email(s) in `ADMIN_EMAILS` env var — currently `ptbdnr@gmail.com` | Create / read / edit / delete **any** content (public or restricted), manage each restricted item's ACL, generate shareable direct links. |

Key design decisions:

- **Admin is configuration, not code.** The admin allowlist lives in an environment
  variable (`ADMIN_EMAILS=ptbdnr@gmail.com`, comma-separated), so it can change without
  a redeploy of code — just update the container env and restart.
- **"Privileged" is not a global role.** It is evaluated *per content item*: a user is
  privileged for item X if their verified email is in X's ACL. The same user may be
  regular for every other item. This matches the requirement that "the group may vary
  for each content".
- **Identity = verified email from the OIDC provider.** Google and Microsoft both return
  a verified email claim; the admin names users on an ACL by email address, so users can
  be granted access before they have ever signed in.

### 1.3 Technology choices

| Concern | Choice | Why |
|---|---|---|
| Authentication | **Auth.js (NextAuth v5)** with `Google` and `Microsoft Entra ID` providers | First-class Next.js App Router support; both providers implement OAuth 2.0 / OpenID Connect; JWT session cookies work without extra infra. |
| Database | **SQLite** (via Prisma or Drizzle) stored on a mounted NAS volume | Single-container, zero extra services, trivially backed up by the NAS. Can swap to Postgres later without schema changes. |
| Deployment | Next.js `output: "standalone"` in a **Docker** image | Small image, runs `node server.js`, ideal for the NAS Docker runtime (UGOS Pro ships Docker). |
| Session strategy | JWT cookies, with `role` and `email` claims | No session table needed; middleware can authorize on the edge of every request. |

### 1.4 Data model

```
ContentItem
  id          string (cuid)
  slug        string (unique)        -- used in shareable direct links
  title       string
  body        text / json
  visibility  enum: 'public' | 'restricted'
  createdAt / updatedAt

ContentAccess                        -- ACL rows, only for restricted items
  contentId   -> ContentItem.id
  email       string (lowercased)    -- named user
  UNIQUE (contentId, email)
```

### 1.5 Authorization rules (enforced server-side)

```
canRead(user, item):
  item.visibility == 'public'                     -> allow (even anonymous)
  user is null                                    -> deny (redirect to sign-in)
  user.email in ADMIN_EMAILS                      -> allow
  exists ContentAccess(item.id, user.email)       -> allow
  otherwise                                       -> deny (404, not 403 — do not
                                                    reveal that the item exists)

canWrite(user, item):  user.email in ADMIN_EMAILS
canUseChat(user):      user != null (any authenticated user)
```

Enforcement happens in **route handlers / server components**, not only in middleware:
middleware gates the `/admin/**` area early, but every data read re-checks the ACL so a
leaked URL is never enough on its own.

### 1.6 Routes to add

| Route | Access |
|---|---|
| `/` (existing portfolio) | public |
| `/api/auth/*` | Auth.js handlers (Google + Microsoft sign-in) |
| `/content/[slug]` | public items: everyone; restricted items: ACL check; unauthenticated visitors hitting a restricted direct link are sent to sign-in and returned to the link afterwards (`callbackUrl`) |
| `/chat` + `/api/chat` | authenticated users only |
| `/admin` (dashboard: list/create/edit/delete content, edit per-item ACL, copy direct link) | admin only |
| `/api/content/*` (CRUD) | GET public/ACL-gated; POST/PUT/DELETE admin only |

### 1.7 Implementation steps

1. **Auth foundation**
   - Add `next-auth@beta` (Auth.js v5); create Google OAuth client (Google Cloud
     Console) and Microsoft app registration (Entra ID); set redirect URIs to
     `https://<your-domain>/api/auth/callback/google` and `.../microsoft-entra-id`.
   - Env vars: `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_MICROSOFT_ENTRA_ID_ID/SECRET`,
     `ADMIN_EMAILS`, `AUTH_TRUST_HOST=true` (behind reverse proxy).
   - In the JWT/session callbacks, lowercase the email and compute
     `role = ADMIN_EMAILS.includes(email) ? 'admin' : 'user'`.
2. **Database + models** — add Prisma/Drizzle with the schema above; mount the SQLite
   file from a NAS volume (`/data/portfolio.db`) so it survives container rebuilds.
3. **Content pages** — `/content/[slug]` server component that runs `canRead` and
   returns `notFound()` on deny; navbar shows sign-in/out state.
4. **Admin dashboard** — CRUD forms, visibility toggle, ACL editor (add/remove emails
   per item), "copy direct link" button producing `https://<domain>/content/<slug>`.
5. **Chat gate** — chat UI and API route both call `auth()`; unauthenticated users get
   the sign-in prompt instead of the chat input.
6. **Dockerize** — `output: "standalone"` in `next.config.ts`, multi-stage Dockerfile,
   `compose.yaml` for the NAS with env file + `/data` volume.
7. **Tests** — Playwright: anonymous sees public only; restricted slug 404s for
   anonymous and regular users; named user reaches it via direct link after sign-in;
   admin CRUD works; chat blocked when signed out.

---

## Part 2 — Step-by-step: expose the container on the UGREEN 4800 Plus to the internet

Goal: users anywhere on the internet open `https://your-domain.tld` (domain registered
at **Namecheap**) and reach the portfolio container on the NAS — no LAN, no VPN.

There are two viable paths. **Option A (Cloudflare Tunnel) is recommended**: it needs no
open router ports, works even if your ISP uses CGNAT, hides your home IP, and gives you
free TLS. Option B (classic port forwarding + Namecheap Dynamic DNS) keeps everything at
Namecheap but exposes your home IP and requires a router you control with a public IPv4.

### Step 0 — Prerequisites (both options)

1. **Run the app as a container on the NAS.** In UGOS Pro open the **Docker** app,
   deploy the portfolio image (from `compose.yaml` or the UI), and bind it to a fixed
   host port, e.g. `3000`. Verify on the LAN first: `http://<NAS-LAN-IP>:3000`.
2. **Give the NAS a static LAN IP** (DHCP reservation in your router, e.g.
   `192.168.1.50`) so forwarding/tunnel targets never move.
3. **Check whether your ISP gives you a real public IPv4** (needed for Option B only):
   compare the WAN IP shown in your router with the IP from `curl ifconfig.me`. If they
   differ, you are behind **CGNAT** and port forwarding cannot work — use Option A.

### Option A (recommended) — Cloudflare Tunnel, domain stays registered at Namecheap

No inbound ports are opened; a lightweight `cloudflared` container on the NAS makes an
*outbound* connection to Cloudflare, and Cloudflare routes your domain's traffic down
that tunnel to the app container.

1. **Create a free Cloudflare account** and add your domain (Free plan → "Add a site").
2. **Point the Namecheap domain at Cloudflare.** Cloudflare shows you two nameservers
   (e.g. `ana.ns.cloudflare.com`, `bob.ns.cloudflare.com`). In Namecheap:
   *Domain List → Manage → Nameservers → Custom DNS* → enter the two Cloudflare
   nameservers → save. The domain **stays registered and paid at Namecheap**; only DNS
   hosting moves. Propagation takes minutes to a few hours; Cloudflare emails you when
   the zone is active.
3. **Create the tunnel.** In the Cloudflare dashboard: *Zero Trust → Networks →
   Tunnels → Create a tunnel* → type "Cloudflared" → name it (e.g. `ugreen-portfolio`).
   Cloudflare shows a `docker run cloudflare/cloudflared ... tunnel run --token <TOKEN>`
   command — copy the token.
4. **Run `cloudflared` on the NAS.** In the UGOS Docker app add a container from image
   `cloudflare/cloudflared:latest` with command
   `tunnel --no-autoupdate run --token <TOKEN>`, restart policy "always". (Or add it as
   a second service in the same `compose.yaml` as the app, on the same Docker network.)
5. **Publish the app through the tunnel.** In the tunnel's *Public Hostnames* tab add:
   - Subdomain: empty (apex) and/or `www`, Domain: `your-domain.tld`
   - Service: `http://<NAS-LAN-IP>:3000` (or `http://portfolio:3000` if `cloudflared`
     shares the app's Docker network — preferred, so the app port never needs to be
     published on the NAS at all).
   Cloudflare creates the DNS records automatically.
6. **Force HTTPS.** In Cloudflare: *SSL/TLS → Overview → Full*, and enable
   "Always Use HTTPS". Browsers get a valid Cloudflare edge certificate automatically —
   no certificate management on the NAS.
7. **Test from outside the LAN** (phone on mobile data): `https://your-domain.tld`
   should load the portfolio, and the OAuth redirect URIs from Part 1 will now work.
8. *(Optional hardening)* Put `/admin` behind **Cloudflare Access** as a second gate
   (Zero Trust → Access → Applications → allow only `ptbdnr@gmail.com`), and enable
   Cloudflare's WAF/rate-limiting free rules.

### Option B — Port forwarding + Namecheap Dynamic DNS + reverse proxy

Only choose this if you have a real public IPv4 (no CGNAT) and control the router.

1. **Install a reverse proxy container on the NAS** — e.g. **Nginx Proxy Manager**
   (image `jc21/nginx-proxy-manager`), publishing host ports `80` and `443` (and `81`
   for its LAN-only admin UI). It will terminate TLS and forward to the app.
2. **Forward ports on your router:** WAN TCP `80 → 192.168.1.50:80` and
   `443 → 192.168.1.50:443`. Forward **nothing else** — in particular never forward the
   UGOS admin ports (`9999`/`9443`) or SSH.
3. **Set up Namecheap Dynamic DNS** (home IPs change): Namecheap *Domain List →
   Manage → Advanced DNS* → enable **Dynamic DNS** (get the DDNS password) → create an
   **A + Dynamic DNS record** for host `@` (and `www`). Then run a DDNS updater on the
   NAS — either the router's built-in DDNS client if it supports Namecheap, or a
   container such as `ddclient` / `qmcgaw/ddns-updater` configured with provider
   `namecheap`, your domain, host `@`, and the DDNS password. It refreshes the A record
   whenever your public IP changes.
4. **Issue a TLS certificate:** in Nginx Proxy Manager create a *Proxy Host* for
   `your-domain.tld` → forward to `http://<NAS-LAN-IP>:3000` → SSL tab → request a
   **Let's Encrypt** certificate (HTTP-01 validation needs port 80 reachable, which
   step 2 provides) → enable "Force SSL" and "HTTP/2".
5. **Test from outside the LAN** as in Option A.
6. **Hardening (important, since your NAS is now directly reachable):** enable
   fail2ban/rate limiting in the proxy, keep UGOS and images auto-updated, disable
   UPnP on the router, and confirm from an external network that only 80/443 answer
   (e.g. an online port scan).

### Notes that apply to both options

- **OAuth redirect URIs** (Part 1) must use the final public HTTPS domain; update the
  Google and Microsoft app registrations after the domain is live.
- Set `AUTH_TRUST_HOST=true` and the canonical `AUTH_URL=https://your-domain.tld` in
  the container env, since the app sits behind a proxy/tunnel.
- **Back up** the SQLite volume (`/data`) with the NAS's snapshot/backup jobs.
- Keep the **UGOS management interface off the internet** — access it via LAN only;
  remote NAS administration should never ride on the same exposure as the webapp.

---

## Suggested delivery order

1. Part 2 Option A (get the domain + tunnel live with the current static site) — this
   unblocks real OAuth redirect URIs.
2. Part 1 steps 1–3 (auth + database + public/restricted content pages).
3. Part 1 steps 4–5 (admin dashboard, chat gate).
4. Part 1 step 7 (E2E tests) and Cloudflare Access hardening for `/admin`.
