# Multi-stage build for Mayordomía gateway.
# Targets ARM64 (Raspberry Pi 4/5) and AMD64 (dev/CI).
# Builder stage: compile TypeScript.
# Uses bookworm-slim (glibc) instead of alpine (musl): cross-arch builds via
# QEMU user-mode emulation crash on Node 20 alpine arm64 with
# 'Illegal instruction' — glibc sidesteps the V8 SIMD paths that break.
FROM node:20-bookworm-slim AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime stage: minimal image with prod deps only.
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=builder /app/dist ./dist
# /run/secrets/sa-key.json is mounted at runtime by docker-compose.
# Falling back to a non-secret path keeps local dev usable.
ENV GOOGLE_SERVICE_ACCOUNT_FILE=/run/secrets/sa-key.json
EXPOSE 3000
USER node
CMD ["node", "dist/index.js"]
