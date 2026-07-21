# Build context must be the monorepo root:
#   docker build -f apps/api/Dockerfile -t courtreach-api .

FROM node:20-alpine
WORKDIR /app

# Enable pnpm via corepack (matches packageManager in root package.json)
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# ------------------------------------------------------------------
# Install dependencies
# Copy only manifests first so this layer is cached unless deps change
# ------------------------------------------------------------------
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/

RUN pnpm install --frozen-lockfile

# ------------------------------------------------------------------
# Build
# ------------------------------------------------------------------
COPY packages/shared ./packages/shared
COPY apps/api ./apps/api

RUN pnpm --filter @courtreach/shared build && \
    pnpm --filter @courtreach/api build && \
    pnpm --filter @courtreach/api exec prisma generate

RUN chmod +x /app/apps/api/start.sh

# ------------------------------------------------------------------
# Runtime
# ------------------------------------------------------------------
WORKDIR /app/apps/api
EXPOSE 4000

# start.sh: runs `prisma migrate deploy`, then starts server + worker
ENTRYPOINT ["/app/apps/api/start.sh"]
