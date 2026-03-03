# syntax=docker/dockerfile:1
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json .npmrc ./
RUN --mount=type=cache,target=/root/.npm \
    npm install --no-audit --no-fund --prefer-offline
COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts
RUN npm run build

# ─── Runtime ──────────────────────────────────────────────────────────────────
FROM node:20-slim AS runtime
WORKDIR /app

# Install Stockfish and curl (for healthcheck)
RUN apt-get update && \
    apt-get install -y --no-install-recommends stockfish curl && \
    rm -rf /var/lib/apt/lists/*

# Copy production node_modules and compiled output from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/scripts ./scripts
COPY db ./db

EXPOSE 7000

CMD ["node", "dist/server.js"]
