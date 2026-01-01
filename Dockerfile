# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .

RUN rm -rf .git .github .vscode .env* .claude

RUN chown -R bun:bun /app

ENV NODE_ENV=production

USER bun
CMD ["bun", "run", "src/index.ts"]
