# Dev-образ «Пиячок» (фронтенд): Next.js 16 dev-сервер із hot-reload
FROM node:22-alpine

WORKDIR /app

# pnpm активується через corepack за полем packageManager у package.json
RUN corepack enable

# Спершу лише маніфести — шар з залежностями кешується, поки вони не зміняться
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

# Решта вихідників (у compose джерело додатково монтується як volume)
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
EXPOSE 3001

# Проєкт стартує разом із контейнером
CMD ["pnpm", "dev"]