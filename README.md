# Notes

Personal notes, tasks, and meetings. One container, SQLite on a volume. Accounts share the same notes. The first account comes from `ADMIN_USERNAME`. Further accounts need `SIGNUP_CODE`.

## Environment

Copy the example and fill it in on the server. Do not commit `.env`.

```bash
cp .env.example .env
```

| Variable | Purpose |
| --- | --- |
| `ADMIN_USERNAME` | Sign-in name. Required. |
| `ADMIN_PASSWORD_HASH` | argon2id hash. Leave `ADMIN_PASSWORD` empty when this is set. |
| `ADMIN_PASSWORD` | Plain password, only until you replace it with a hash. |
| `SIGNUP_CODE` | Code required by Create account. Leave it empty to keep registration closed. |
| `SESSION_SECRET` | At least 32 bytes. Signs the session cookie. |
| `COOKIE_SECURE` | `true` in production so the cookie is `Secure`. Use `false` only for HTTP on localhost. |
| `ALLOWED_ORIGINS` | Comma-separated origins allowed to send unsafe requests. Production: `https://notes.janrosell.com`. |
| `TRUST_PROXY` | `true` behind Caddy. The login limiter uses the first `X-Forwarded-For` hop. |
| `USER_TIMEZONE` | IANA zone stored for the account. Default `Europe/Madrid`. |
| `DATA_DIR` | Database directory inside the container. Keep `/data`. |
| `AI_API_KEY`, `GOOGLE_CALENDAR_CLIENT_ID`, `MS_GRAPH_CLIENT_ID` | Read by `GET /api/integrations` only. Nothing in v1 connects them. |

Startup exits if `SESSION_SECRET` is shorter than 32 bytes, if `ADMIN_USERNAME` is empty, or if both password variables are empty.

Generate the password hash from the backend environment:

```bash
cd backend
python -m app.security hash-password
```

Paste the printed hash into `ADMIN_PASSWORD_HASH` and leave `ADMIN_PASSWORD` empty.

## Docker Compose

From the repository root, with `.env` in place:

```bash
docker compose up --build -d
```

The service listens on `127.0.0.1:8000` only. The database file is `/data/notes.db` on the named volume `notes-data`. The directory is created on startup and owned by uid 1000.

```bash
docker compose ps
docker compose logs -f notes
```

`GET /api/health` returns 200 without a cookie.

## Caddy

Install Caddy on the host. Point a DNS record for `notes.janrosell.com` at the VPS, then use `deploy/Caddyfile.example`:

```caddy
notes.janrosell.com {
  reverse_proxy 127.0.0.1:8000
}
```

Caddy obtains the certificate and sets `X-Forwarded-Proto`. Keep `COOKIE_SECURE=true` and `ALLOWED_ORIGINS=https://notes.janrosell.com`. The cookie `Secure` flag follows `COOKIE_SECURE`, not the request scheme.

Reload Caddy after editing the site file. The app process stays bound to localhost.

## Backups

Sign in and open Settings, or call the routes with the session cookie:

- `GET /api/backup/json` downloads `notes-YYYYMMDD.json`.
- `GET /api/backup/sqlite` downloads a consistent SQLite snapshot.

Both need the session cookie. Copy the files off the VPS. Restoring the sqlite file means replacing `/data/notes.db` on the volume while the container is stopped:

```bash
docker compose stop
docker compose cp notes-YYYYMMDD.sqlite notes:/data/notes.db
docker compose start
```

`docker compose cp` writes as root. After copying, fix the owner so uid 1000 can open the file:

```bash
docker compose exec -u root notes chown 1000:1000 /data/notes.db
```

## iOS and the share target

Chrome and other browsers that implement Web Share Target open `GET /capture?title=&text=&url=`. The installed app creates one Inbox note from that link.

iOS Safari does not implement `share_target`. The manifest entry is ignored there. On an iPhone, open the installed app and use Quick Note, Quick Task, or Paste transcript. A share longer than 32 KB is refused; paste that text inside the app.

## Local checks

Frontend, from `frontend/`:

```bash
npm run typecheck
npm run build
```

Backend, from `backend/` with the virtualenv:

```bash
.venv/bin/pytest -W error
```
