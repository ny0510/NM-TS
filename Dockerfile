# syntax=docker/dockerfile:1

FROM oven/bun:1 AS base
WORKDIR /app

# 의존성 설치 단계
FROM base AS install
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

# 실행 단계
FROM base AS release
COPY --from=install /app/node_modules ./node_modules
COPY . .

# 불필요한 파일 제거
RUN rm -rf .git .github .vscode .env* .claude

# 환경 변수
ENV NODE_ENV=production

# 실행
USER bun
CMD ["bun", "run", "src/index.ts"]
