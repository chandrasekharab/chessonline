# Chess Insight Engine — Deployment Plan

> Last updated: 2026-07-01  
> Git remote: `https://github.com/chandrasekharab/chessonline`

---

## Table of Contents
1. [Architecture Overview](#1-architecture-overview)
2. [Services & Ports](#2-services--ports)
3. [Pre-Deployment Checklist](#3-pre-deployment-checklist)
4. [Environment Variables](#4-environment-variables)
5. [Local Development](#5-local-development)
6. [Production — Single VPS](#6-production--single-vps)
7. [SSL / TLS](#7-ssl--tls)
8. [Database — Migration & Seeds](#8-database--migration--seeds)
9. [CI/CD Pipeline (GitHub Actions)](#9-cicd-pipeline-github-actions)
10. [Scaling Strategy](#10-scaling-strategy)
11. [Monitoring & Logging](#11-monitoring--logging)
12. [Rollback Procedure](#12-rollback-procedure)
13. [Cloud PaaS Alternatives](#13-cloud-paas-alternatives)

---

## 1. Architecture Overview

```
                  ┌─────────────────────────────────────────────────────┐
Internet ─HTTPS──►│  nginx (chess_frontend :443/:80)                    │
                  │  • serves React SPA (static)                         │
                  │  • reverse-proxy API routes                          │
                  └──────┬───────────────────────────┬───────────────────┘
                         │                           │
          /auth /games /live /puzzles            /socket.io/
          /tutorial /explanations /health        (WebSocket upgrade)
                         │                           │
                  ┌──────▼───────────────────────────▼──────────────────┐
                  │  Express API  (chess_backend :7000)                  │
                  │  + Socket.IO live multiplayer server                 │
                  └───────────┬────────────────────────┬────────────────┘
                              │                        │
               ┌──────────────┴──┐                  LLM Provider
               ▼                 ▼                 (OpenAI / Ollama)
      PostgreSQL 16          Redis 7
    (chess_postgres)       (chess_redis)
                                │
                       BullMQ analysis queue
                                │
                                ▼
                   Analysis Worker (chess_worker)
                   node:20-slim + Stockfish UCI
                   + AI explanation pipeline
```

---

## 2. Services & Ports

| Container | Image | Internal Port | Host Port (dev) | Host Port (prod) |
|---|---|---|---|---|
| `chess_frontend` | `nginx:alpine` | 80 | 8001 | 443 / 80 |
| `chess_backend` | `node:20-slim` | 7000 | 8000 | not exposed (nginx proxies) |
| `chess_worker` | `node:20-slim` | — | — | — |
| `chess_postgres` | `postgres:16-alpine` | 5432 | 7432 | not exposed |
| `chess_redis` | `redis:7-alpine` | 6379 | 7379 | not exposed |

> **Production rule:** only port 80/443 (nginx) are publicly reachable. All other ports are internal Docker network only.

---

## 3. Pre-Deployment Checklist

### Secrets
- [ ] `JWT_SECRET` — 64+ random bytes: `openssl rand -hex 64`
- [ ] `POSTGRES_PASSWORD` — strong password, not default `chess_pass`
- [ ] Change `POSTGRES_USER` / `POSTGRES_DB` if desired
- [ ] Never commit `.env` (ensured by `.gitignore`)

### Server Requirements (VPS)
- [ ] Ubuntu 22.04 LTS or Debian 12 (recommended)
- [ ] 2 vCPU / 4 GB RAM minimum (Stockfish is CPU-intensive at depth 18)
- [ ] 20 GB SSD (PostgreSQL data + Docker images)
- [ ] Docker Engine 24+ and Docker Compose v2 installed
- [ ] A domain name pointed to the server's IP

### Pre-flight
- [ ] `git pull origin main` on the server
- [ ] `.env` exists and all values are set (copy from `.env.example`)
- [ ] `docker compose config` succeeds (no invalid references)
- [ ] Firewall allows 80, 443 in; blocks 7432, 7379, 8000
- [ ] If enabling AI explanations: set `AI_EXPLANATIONS_ENABLED=true`, `LLM_PROVIDER`, and the corresponding API key; run the `ai_explanation_migration.sql` migration

---

## 4. Environment Variables

Create `/opt/chessplatform/.env` on the server:

```dotenv
# ── Required ────────────────────────────────────────────────────────────────
JWT_SECRET=<openssl rand -hex 64>
CORS_ORIGIN=https://yourdomain.com

# ── PostgreSQL (override defaults if desired) ────────────────────────────────
# These are consumed by the postgres service init; only needed if overriding
# POSTGRES_USER=chess_user
# POSTGRES_PASSWORD=<strong-password>
# POSTGRES_DB=chess_insight

# ── Optional tuning ─────────────────────────────────────────────────────────
ENGINE_DEPTH=18          # Stockfish search depth (higher = slower, stronger)
ENGINE_MAX_CONCURRENT=2  # Max simultaneous Stockfish processes per worker

# ── AI Explanations (optional) ──────────────────────────────────────────────
AI_EXPLANATIONS_ENABLED=false   # Set to true to enable LLM move explanations
LLM_PROVIDER=openai             # openai | anthropic | ollama | custom
LLM_MODEL=gpt-4o-mini           # Any compatible model name
LLM_BASE_URL=                   # Custom OpenAI-compatible base URL (optional)
OPENAI_API_KEY=                 # Required if LLM_PROVIDER=openai
ANTHROPIC_API_KEY=              # Required if LLM_PROVIDER=anthropic
EXPLANATION_MIN_DROP_CP=100     # Min eval drop to request an explanation
LLM_MAX_TOKENS=300              # Max tokens per explanation response
```

> In production the `DATABASE_URL` and `REDIS_URL` in `docker-compose.yml` reference the internal service hostnames (`postgres`, `redis`) and do NOT need `.env` overrides unless you change `POSTGRES_USER`/`POSTGRES_PASSWORD`.

---

## 5. Local Development

### First boot
```bash
git clone https://github.com/chandrasekharab/chessonline.git chessplatform
cd chessplatform

cp .env.example .env
# Edit .env — set JWT_SECRET at minimum

docker compose up --build
```

App available at `http://localhost:8001`  
Backend API at `http://localhost:8000`

### Seed demo data (optional)
```bash
docker compose exec backend npm run db:seed
```
Creates three users: `alice@chess.dev`, `bob@chess.dev`, `admin@chess.dev`  
Password for all: `Chess1234!`

### Common operations
```bash
# Tail all logs
docker compose logs -f

# Restart a single service after code changes
docker compose up --build -d backend

# Open psql shell
docker compose exec postgres psql -U chess_user -d chess_insight

# Check queue depth
docker compose exec redis redis-cli llen bull:analysis:wait
```

---

## 6. Production — Single VPS

### 6.1 Server setup
```bash
# Install Docker
curl -fsSL https://get.docker.com | sh
usermod -aG docker $USER
newgrp docker

# Clone repo
mkdir -p /opt/chessplatform
git clone https://github.com/chandrasekharab/chessonline.git /opt/chessplatform
cd /opt/chessplatform
cp .env.example .env && nano .env   # fill in JWT_SECRET, CORS_ORIGIN
```

### 6.2 Production docker-compose override

Create `/opt/chessplatform/docker-compose.prod.yml`:

```yaml
services:
  # Remove dev host-port exposure for internal services
  postgres:
    ports: []           # Not exposed publicly

  redis:
    ports: []           # Not exposed publicly

  backend:
    ports: []           # nginx proxies; not exposed publicly
    environment:
      NODE_ENV: production
      CORS_ORIGIN: https://yourdomain.com

  worker:
    deploy:
      replicas: 2       # Two workers for higher analysis throughput
      resources:
        limits:
          cpus: '2.0'
          memory: 768M

  frontend:
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - /etc/letsencrypt:/etc/letsencrypt:ro
      - /opt/chessplatform/frontend/nginx.prod.conf:/etc/nginx/conf.d/default.conf:ro
```

### 6.3 Start production stack
```bash
cd /opt/chessplatform
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 6.4 Verify
```bash
docker compose ps                             # all containers healthy
curl -si http://yourdomain.com/health         # {"status":"ok"}
```

---

## 7. SSL / TLS

### Option A — Certbot (Let's Encrypt) — recommended
```bash
# On the host (not inside Docker)
apt install certbot
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com \
  --email you@example.com --agree-tos

# Certs are written to /etc/letsencrypt/live/yourdomain.com/
# docker-compose.prod.yml mounts /etc/letsencrypt into the frontend container
```

Create `frontend/nginx.prod.conf`:

```nginx
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;

    root /usr/share/nginx/html;
    index index.html;

    location ~ ^/(auth|games|live|puzzles|tutorial|explanations|health) {
        proxy_pass http://backend:7000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto https;
    }

    location /socket.io/ {
        proxy_pass http://backend:7000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-Proto https;
        proxy_read_timeout 86400;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
}
```

Auto-renew cron (add to host crontab):
```cron
0 2 * * 0 certbot renew --quiet && docker compose -f /opt/chessplatform/docker-compose.yml restart frontend
```

### Option B — Cloudflare Proxy
Point your domain to Cloudflare, enable the orange-cloud proxy, set SSL mode to "Full (strict)". No cert installation needed on the server; nginx stays HTTP-only internally.

---

## 8. Database — Migration & Seeds

### Schema (auto-applied)
`backend/db/schema.sql` is mounted into the postgres container as an init script. It runs automatically on **first boot** if the data volume is empty.

Additional migration files (run manually after the first boot if upgrading an existing deployment):

```bash
# Apply puzzle table schema
docker compose exec postgres psql -U chess_user -d chess_insight \
  -f /docker-entrypoint-initdb.d/puzzle_migration.sql

# Apply AI explanation tables (required if AI_EXPLANATIONS_ENABLED=true)
docker compose exec postgres psql -U chess_user -d chess_insight \
  -f /docker-entrypoint-initdb.d/ai_explanation_migration.sql
```

To re-apply the core schema after changes on an existing deployment:
```bash
docker compose exec postgres psql -U chess_user -d chess_insight \
  -f /docker-entrypoint-initdb.d/01_schema.sql
```

### Backups
```bash
# Dump
docker compose exec postgres pg_dump -U chess_user chess_insight \
  | gzip > backups/chess_$(date +%Y%m%d_%H%M%S).sql.gz

# Restore
gunzip < backups/chess_20260303_120000.sql.gz \
  | docker compose exec -T postgres psql -U chess_user chess_insight
```

Automate with a daily cron on the host:
```cron
0 3 * * * cd /opt/chessplatform && docker compose exec -T postgres \
  pg_dump -U chess_user chess_insight | gzip > /opt/backups/chess_$(date +\%Y\%m\%d).sql.gz
```

---

## 9. CI/CD Pipeline (GitHub Actions)

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SERVER_SSH_KEY }}
          script: |
            cd /opt/chessplatform
            git pull origin main
            docker compose -f docker-compose.yml -f docker-compose.prod.yml \
              up -d --build --remove-orphans
            docker image prune -f
```

### Required GitHub Secrets
| Secret | Value |
|---|---|
| `SERVER_HOST` | VPS IP or domain |
| `SERVER_USER` | `ubuntu` or deploy user |
| `SERVER_SSH_KEY` | Private key for SSH access |

---

## 10. Scaling Strategy

### Horizontal scaling options

| Bottleneck | Solution |
|---|---|
| **Analysis throughput** | Increase `worker` replicas in `docker-compose.prod.yml` (each worker uses 2 CPU cores) |
| **API concurrency** | Scale `backend` replicas + add nginx `upstream` load-balancer block |
| **Database connections** | Enable `PgBouncer` connection pooler between backend and PostgreSQL |
| **Redis load** | Switch to Redis Sentinel or Redis Cluster for HA |
| **Static assets** | Offload to CDN (Cloudflare, S3 + CloudFront) |

### Worker replica tuning
```yaml
# docker-compose.prod.yml
worker:
  deploy:
    replicas: 3       # 3 workers × depth-18 = ~6 CPU cores needed
    resources:
      limits:
        cpus: '2.0'
        memory: 768M
```

---

## 11. Monitoring & Logging

### Health endpoints
- `GET /health` — returns `{"status":"ok","db":"ok","redis":"ok"}`
- `GET /health/live` — Socket.IO server liveness

### Log aggregation (Loki + Grafana — optional)
```yaml
# Add to docker-compose.prod.yml
  loki:
    image: grafana/loki:2.9.0
  grafana:
    image: grafana/grafana:latest
    ports: ["3000:3000"]
```

Configure Docker's JSON-file logging driver to forward to Loki, or use Grafana Cloud's free tier.

### Uptime monitoring
- **UptimeRobot** (free) — ping `https://yourdomain.com/health` every 5 min
- **Better Uptime** / **HetrixTools** — for SMS/PagerDuty-style alerting

### Resource alerts
```bash
# Quick spot-check
docker stats --no-stream
```

---

## 12. Rollback Procedure

### Application rollback
```bash
# SSH into server
cd /opt/chessplatform

# Find previous working commit
git log --oneline -10

# Checkout previous commit
git checkout <commit-sha>

# Rebuild and restart
docker compose -f docker-compose.yml -f docker-compose.prod.yml \
  up -d --build
```

### Database rollback
If a schema migration was applied:
```bash
# Restore from last backup
gunzip < /opt/backups/chess_<yesterday>.sql.gz \
  | docker compose exec -T postgres psql -U chess_user chess_insight
```

### Emergency: full data volume reset
```bash
docker compose down -v          # destroys postgres_data and redis_data
docker compose up -d            # recreates from schema.sql + blank state
```
⚠️ This destroys all user data — only use if data is expendable or already backed up.

---

## 13. Cloud PaaS Alternatives

If managing a VPS is undesirable, the stack can be deployed to managed platforms:

### Railway (easiest)
1. Connect GitHub repo to Railway
2. Add services: `backend`, `worker`, `frontend`, `postgres` (managed), `redis` (managed)
3. Set env vars in Railway dashboard
4. Railway auto-deploys on every push to `main`

Limitation: Stockfish must be installed in the Dockerfile at runtime (works fine with `apt-get install stockfish`).

### Render
- `backend` → Web Service (Docker)
- `worker` → Background Worker (Docker, `Dockerfile.worker`)
- `frontend` → Static Site (build command: `npm run build`, publish: `dist/`)
- PostgreSQL → Render Managed Postgres
- Redis → Render Managed Redis

### Fly.io
```bash
fly launch --dockerfile backend/Dockerfile --name chess-backend
fly launch --dockerfile backend/Dockerfile.worker --name chess-worker
fly postgres create --name chess-db
fly redis create --name chess-redis
```

### AWS (full production)
| Service | Used for |
|---|---|
| ECS Fargate | `backend`, `worker`, `frontend` containers |
| RDS PostgreSQL | Managed Postgres |
| ElastiCache Redis | Managed Redis |
| ALB | HTTPS load balancer → ECS |
| ECR | Docker image registry |
| S3 + CloudFront | Frontend static assets (alternative to nginx) |
| Secrets Manager | `JWT_SECRET`, DB credentials |

---

## Quick Reference Card

```bash
# ── Local ──────────────────────────────────────────────────────────────────
docker compose up --build           # first run
docker compose up -d                # subsequent runs
docker compose logs -f backend      # tail backend logs
docker compose down                 # stop all
docker compose down -v              # stop all + wipe volumes

# ── Production ─────────────────────────────────────────────────────────────
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
docker compose ps
curl https://yourdomain.com/health

# ── Database ───────────────────────────────────────────────────────────────
docker compose exec postgres psql -U chess_user -d chess_insight
docker compose exec backend npm run db:seed

# ── Secrets ────────────────────────────────────────────────────────────────
openssl rand -hex 64                # generate JWT_SECRET
```
