# Build context is the MONOREPO ROOT (docker-compose: context: ., dockerfile: apps/api/Dockerfile).
# Installs the workspaces from the root lockfile, builds the API + widget, ships only what runs.

FROM node:20-alpine AS builder
WORKDIR /app

# Workspace manifests first so `npm ci` is cached until a dependency changes
COPY package.json package-lock.json turbo.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/widget/package.json ./apps/widget/package.json
COPY packages/shared/package.json ./packages/shared/package.json
RUN npm ci --no-audit --no-fund

COPY apps/api ./apps/api
COPY apps/widget ./apps/widget
COPY packages/shared ./packages/shared
RUN npm run build:api && npm run build:widget

# Drop dev dependencies for the runtime image
RUN npm prune --omit=dev --no-audit --no-fund


FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nestjs && \
    apk add --no-cache curl

COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./apps/api/package.json
COPY --from=builder /app/apps/api/dist ./apps/api/dist
# Served at /widget.js by the API (resolved relative to apps/api/dist)
COPY --from=builder /app/apps/widget/dist ./apps/widget/dist
COPY --from=builder /app/packages/shared ./packages/shared

USER nestjs

# Listens on API_PORT (default 4000)
EXPOSE 4000

CMD ["node", "apps/api/dist/main"]
