FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS deps
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
WORKDIR /app

# Non-root user setup from the beginning to avoid permission issues
USER bun

# Copy dependencies with correct ownership
COPY --from=deps --chown=bun:bun /app/node_modules ./node_modules
COPY --from=deps --chown=bun:bun /app/package.json ./package.json

# Copy source code with correct ownership
COPY --chown=bun:bun . .

# Create necessary directories (if not exist in source)
RUN mkdir -p lavalink/plugins magmastream

ENV NODE_ENV=production

CMD ["bun", "run", "src/index.ts"]