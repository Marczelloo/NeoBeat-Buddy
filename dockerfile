# ---- base image with pnpm enabled ----
# FROM node:20-bullseye-slim AS base # Use this for full Debian environment
FROM node:20-alpine AS base

WORKDIR /app
RUN corepack enable

# ---- install dependencies ----
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# ---- production runner ----
FROM base AS runner
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["pnpm", "start"]
