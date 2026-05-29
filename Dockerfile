# syntax=docker/dockerfile:1.7
FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN --mount=type=cache,id=bun-install-cache,target=/root/.bun/install/cache \
  bun install --frozen-lockfile --production --no-progress

FROM base AS release
WORKDIR /app

RUN chown bun:bun /app

USER bun

COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/package.json ./package.json

COPY --chown=bun:bun . .

RUN mkdir -p lavalink/plugins shoukaku

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]
