FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

RUN mkdir -p /app/lavalink/plugins /app/magmastream \
  && find /app -mindepth 1 -maxdepth 1 ! -name 'node_modules' -exec chown -R bun:bun {} +

ENV NODE_ENV=production

USER bun
CMD ["bun", "run", "src/index.ts"]