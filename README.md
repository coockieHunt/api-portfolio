# mail-api

Node.js/Express API with blog, mail, assets, tags, counters, and guestbook. Redis is used for caching/counters; JWT for auth; Helmet, rate limiting, IP whitelist, validation, and centralized error handling are enabled.

## Features
- **Auth**: JWT login/logout with token revocation.
- **Mail**: `POST /api/mail/sendEmail`.
- **Guestbook**: read/write/delete (password-protected).
- **Blog**:
  - Get all/offset, get by slug (public or auth); drafts are 404 for guests and never cached.
  - Create/update/publish/unpublish; supports `featuredImage`.
  - Cache controls: server cache TTL and client `Cache-Control` max-age are configurable.
  - Cache management endpoints to clear a slug or all.
- **Tags**: list, get by slug, create, delete.
- **Assets**: upload/delete/cache-clear, proxy/resizing, OpenGraph generation.
- **Counters**: get/set/increment; key whitelist enforced.
- **Health**: Redis/SMTP check.

## Configuration
Precedence: **env vars > static.config.json**. Defaults live in `static.config.json`; `config/default.ts` loads them with env overrides.

Key settings
- Ports/paths: `PORT`, `API_ROOT`, `ASSET_ROOT`.
- Auth: `ACCESS_TOKEN_SECRET` (JWT).
- Mail: `MAIL_HOST`, `MAIL_PORT`, `MAIL_SECURE`, `MAIL_USER`, `MAIL_PASS`.
- Guestbook password: `SECRET_PASSWORD`.
- Redis: `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`.
- Rate limiter: toggle + per-route in `static.config.json`.
- Blog cache:
  - Server cache: `BLOG_CACHE_TTL` (fallback to `static.blog.cache_ttl`, default 86400s).
  - Client cache header: `BLOG_CACHE_CLIENT_AGE` (fallback to `static.blog.cache_client_age`, default 300s).
  - OG cache toggle: `BLOG_OG_CACHE`.
- IP whitelist: `IP_WHITELIST` (comma-separated).
- CORS: `CORS_ORIGINS` (comma-separated).

### Env file strategy

Use separate env files by runtime target:

- `api-mail/.env` → standalone local dev (`npm run dev`)
- `api-mail/.env.docker.local` → Docker local profile (`docker-compose.local.yml`)
- `api-mail/.env.docker.prod` → Docker production profile (`docker-compose.prod.yml`)

Cookie auth is also profile-specific:

- local: `AUTH_COOKIE_SECURE=false`, `AUTH_COOKIE_SAMESITE=lax`
- prod: `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=none`, `AUTH_COOKIE_DOMAIN=.your-domain.tld`

With Docker, use the matching compose file so the correct env is loaded automatically.

## Installation
```bash
npm install
# copy .env from .env.example and adjust
npm run dev   # nodemon
# npm start   # production
```
Default base URL: `http://localhost:3001/api`.

## Endpoints (main)
- **Health**: `GET /api/health`
- **Auth**: `POST /api/auth/login`, `POST /api/auth/logout`
- **Mail**: `POST /api/mail/sendEmail`
- **Guestbook**: `GET /api/guestbook?password=...`, `POST /api/guestbook`, `DELETE /api/guestbook/:id`
- **Blog**:
  - `GET /api/blog/all?page=&limit=`
  - `GET /api/blog/offset?min=&max=&tagsContains=&titleContains=`
  - `GET /api/blog/:slug` (drafts 404 for guests; no cache for drafts)
  - `POST /api/blog/new`
  - `PUT /api/blog/edit/update/:slug`
  - `PUT /api/blog/edit/publish/:slug`
  - `DELETE /api/blog/:slug`
  - Cache: `DELETE /api/blog/cache/delete/:slug`, `DELETE /api/blog/cache/clear/`
- **Tags**: `GET /api/tags/`, `GET /api/tags/:slug`, `POST /api/tags/`, `DELETE /api/tags/:slug`
- **Assets**: `POST /api/assets/upload`, `DELETE /api/assets/delete/:folder/:id`, `DELETE /api/assets/cache/clear/:id`, `DELETE /api/assets/cache/all`, `GET /assets/proxy/...`, `GET /assets/opengraph/get`
- **Counters**: `GET /api/counter/:name`, `POST /api/counter/:name`, `POST /api/counter/:name/increment`

## Caching & security notes
- Blog drafts: never cached; guests receive 404; authenticated users see all.
- Cache headers for public blog responses use `cache_client_age`; server cache TTL uses `cache_ttl`.
- Helmet, rate limiting, IP whitelist, validation, and centralized error handling are enabled.

## Redis keys
Whitelisted keys are defined in `constants/redis.constant.ts`. Only mapped keys are accepted by counter routes.

## Docker/Redis tip
If Redis runs in Docker, set `REDIS_HOST` to the container hostname or service name; default is `localhost`.
- **Mail (`/api/mail`)**

  - `POST /sendEmail` - Send contact email.

    - Body: `{ name, email, message, subject? }`


