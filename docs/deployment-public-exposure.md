# Exposing the portfolio container (UGREEN NAS 4800 Plus) to the internet

Goal: users anywhere on the internet open `https://your-domain.tld` (domain registered
at **Namecheap**) and reach the portfolio container on the NAS — **no LAN, no VPN**.

There are two viable paths:

- **Option A — Cloudflare Tunnel (recommended).** No open router ports, works even behind
  CGNAT, hides your home IP, free TLS. The domain **stays registered at Namecheap**; only
  DNS hosting moves to Cloudflare.
- **Option B — Port forwarding + Namecheap Dynamic DNS.** Keeps everything at Namecheap
  but exposes your home IP and needs a router you control with a real public IPv4.

---

## Step 0 — Prerequisites (both options)

1. **Run the app as a container on the NAS.** In UGOS Pro open the **Docker** app and
   deploy from this repo's `compose.yaml` (or build the image and run it), binding it to a
   fixed host port, e.g. `3000`. Verify on the LAN first: `http://<NAS-LAN-IP>:3000`.
   - Provide the environment (`.env`, see `.env.example`): `AUTH_SECRET`, the Google and
     Microsoft OAuth credentials, `ADMIN_EMAILS`, and `DATABASE_URL=file:/data/portfolio.db`.
   - The container applies DB migrations on startup and stores SQLite on the `/data`
     volume.
2. **Give the NAS a static LAN IP** (DHCP reservation in your router, e.g. `192.168.1.50`)
   so forwarding/tunnel targets never move.
3. **Check for CGNAT** (matters for Option B only): compare the WAN IP shown in your
   router with the result of `curl ifconfig.me`. If they differ you are behind CGNAT and
   port forwarding cannot work — use Option A.

---

## Option A (recommended) — Cloudflare Tunnel

A lightweight `cloudflared` container on the NAS makes an **outbound** connection to
Cloudflare; Cloudflare routes your domain's traffic down that tunnel to the app. No
inbound ports are opened.

1. **Create a free Cloudflare account** and add your domain (Free plan → "Add a site").
2. **Point the Namecheap domain at Cloudflare.** Cloudflare shows two nameservers (e.g.
   `ana.ns.cloudflare.com`, `bob.ns.cloudflare.com`). In Namecheap:
   *Domain List → Manage → Nameservers → Custom DNS* → enter the two Cloudflare
   nameservers → save. The domain stays registered/paid at Namecheap; only DNS hosting
   moves. Cloudflare emails you when the zone is active (minutes to a few hours).
3. **Create the tunnel.** Cloudflare dashboard: *Zero Trust → Networks → Tunnels →
   Create a tunnel* → type "Cloudflared" → name it (e.g. `ugreen-portfolio`). Copy the
   token from the `docker run ... --token <TOKEN>` command it shows.
4. **Run `cloudflared` on the NAS.** Either add a container from image
   `cloudflare/cloudflared:latest` with command `tunnel --no-autoupdate run --token <TOKEN>`
   (restart policy "always"), or uncomment the `cloudflared` service in `compose.yaml` and
   set `TUNNEL_TOKEN` in `.env`.
5. **Publish the app through the tunnel.** In the tunnel's *Public Hostnames* tab add:
   - Subdomain: empty (apex) and/or `www`; Domain: `your-domain.tld`
   - Service: `http://portfolio:3000` if `cloudflared` shares the app's Docker network
     (preferred — then the app port need not be published on the NAS at all), otherwise
     `http://<NAS-LAN-IP>:3000`.

   Cloudflare creates the DNS records automatically.
6. **Force HTTPS.** Cloudflare *SSL/TLS → Overview → Full*, and enable "Always Use HTTPS".
   Visitors get a valid Cloudflare edge certificate — no cert management on the NAS.
7. **Test from outside the LAN** (phone on mobile data): `https://your-domain.tld`.
8. *(Optional hardening)* Put `/admin` behind **Cloudflare Access** as a second gate
   (*Zero Trust → Access → Applications* → allow only `ptbdnr@gmail.com`) and enable the
   free WAF / rate-limiting rules.

---

## Option B — Port forwarding + Namecheap Dynamic DNS + reverse proxy

Only if you have a real public IPv4 (no CGNAT) and control the router.

1. **Install a reverse proxy container on the NAS** — e.g. **Nginx Proxy Manager** (image
   `jc21/nginx-proxy-manager`), publishing host ports `80` and `443` (its admin UI on `81`
   stays LAN-only). It terminates TLS and forwards to the app.
2. **Forward ports on your router:** WAN TCP `80 → 192.168.1.50:80` and
   `443 → 192.168.1.50:443`. Forward **nothing else** — never the UGOS admin ports
   (`9999`/`9443`) or SSH.
3. **Set up Namecheap Dynamic DNS** (home IPs change): Namecheap *Domain List → Manage →
   Advanced DNS* → enable **Dynamic DNS** (note the DDNS password) → create an
   **A + Dynamic DNS** record for host `@` (and `www`). Then run a DDNS updater on the NAS
   — the router's built-in Namecheap DDNS client, or a container such as `ddclient` /
   `qmcgaw/ddns-updater` (provider `namecheap`, your domain, host `@`, the DDNS password).
4. **Issue a TLS certificate:** in Nginx Proxy Manager create a *Proxy Host* for
   `your-domain.tld` → forward to `http://<NAS-LAN-IP>:3000` → SSL tab → request a
   **Let's Encrypt** certificate (HTTP-01 needs port 80 reachable, which step 2 provides) →
   enable "Force SSL" and "HTTP/2".
5. **Test from outside the LAN** as in Option A.
6. **Hardening (important — the NAS is now directly reachable):** enable
   fail2ban/rate limiting in the proxy, keep UGOS and images updated, disable UPnP on the
   router, and confirm from an external network that only `80`/`443` answer.

---

## Notes that apply to both options

- **OAuth redirect URIs** must use the final public HTTPS domain. After the domain is
  live, set them in the provider consoles:
  - Google Cloud Console → `https://your-domain.tld/api/auth/callback/google`
  - Microsoft Entra ID → `https://your-domain.tld/api/auth/callback/microsoft-entra-id`
- Set `AUTH_TRUST_HOST=true` and `AUTH_URL=https://your-domain.tld` in the container env,
  since the app sits behind a proxy/tunnel.
- **Back up** the `/data` SQLite volume with the NAS's snapshot/backup jobs.
- Keep the **UGOS management interface off the internet** — LAN access only. Remote NAS
  administration must never ride on the same exposure as the webapp.

---

## Suggested delivery order

1. Option A above with the current app, so real OAuth redirect URIs work.
2. Configure the Google + Microsoft OAuth apps and fill `.env`.
3. Sign in as `ptbdnr@gmail.com`, create public/restricted content from `/admin`.
4. Add Cloudflare Access in front of `/admin` for defense-in-depth.
