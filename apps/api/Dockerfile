FROM node:22-alpine
RUN apk add --no-cache python3 make g++
WORKDIR /app

# pnpm активується через corepack за полем packageManager
RUN corepack enable

# Спершу маніфести воркспейсу — шар з залежностями кешується
# (заморожений lockfile з importers apps/* вимагає обидва package.json)
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile

COPY apps/api ./apps/api
EXPOSE 3000

CMD ["pnpm", "--filter", "backend-final", "start:dev"]
