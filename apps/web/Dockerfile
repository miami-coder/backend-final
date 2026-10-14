# Dev-образ «Пиячок» (фронтенд): Next.js 16 dev-сервер
FROM node:22-alpine
WORKDIR /app

RUN corepack enable

# Маніфести воркспейсу — шар з залежностями кешується
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/web/package.json apps/web/package.json
COPY apps/api/package.json apps/api/package.json
RUN pnpm install --frozen-lockfile

COPY apps/web ./apps/web

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001

CMD ["pnpm", "--filter", "frontend-final", "dev"]
