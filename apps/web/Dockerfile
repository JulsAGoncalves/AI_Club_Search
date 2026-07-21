# Build context must be the monorepo root:
#   docker build -f apps/web/Dockerfile \
#     --build-arg NEXT_PUBLIC_API_URL=https://your-api-apprunner-url.com \
#     -t courtreach-web .
#
# NOTE: NEXT_PUBLIC_API_URL is baked into the client bundle at build time.
# Deploy the API service first, copy its App Runner URL, then build this image.

FROM node:20-alpine
WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1

# Enable pnpm via corepack (matches packageManager in root package.json)
RUN corepack enable && corepack prepare pnpm@11.9.0 --activate

# ------------------------------------------------------------------
# Install dependencies
# ------------------------------------------------------------------
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN pnpm install --frozen-lockfile

# ------------------------------------------------------------------
# Build
# NEXT_PUBLIC_* vars must be present at build time so Next.js can
# embed them in the client-side bundle.
# ------------------------------------------------------------------
COPY packages/shared ./packages/shared
COPY apps/web ./apps/web

ARG NEXT_PUBLIC_API_URL=http://localhost:4000
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

RUN pnpm --filter @courtreach/shared build && \
    pnpm --filter @courtreach/web build

# ------------------------------------------------------------------
# Runtime
# ------------------------------------------------------------------
WORKDIR /app/apps/web
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["pnpm", "start"]
