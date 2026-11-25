# صورة الموقع للمعاينة والإنتاج. السياق: جذر المستودع (docker compose يمرره).
FROM node:22-bookworm-slim

ENV NEXT_TELEMETRY_DISABLED=1 \
    PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH
RUN corepack enable

WORKDIR /app

# الاعتماديات أولًا لتُخزَّن الطبقة ما دام ملف القفل لم يتغير
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/
COPY packages/db/package.json packages/db/prisma.config.ts packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/domain/package.json packages/domain/
COPY packages/payments/package.json packages/payments/
RUN pnpm install --frozen-lockfile

COPY . .
# البناء لا يحتاج أسرارًا (الإعداد يُتحقق منه عند الإقلاع)
RUN pnpm --filter @masar/db generate && pnpm build

ARG APP_VERSION=dev
ENV APP_VERSION=$APP_VERSION \
    NODE_ENV=production \
    PORT=3000

USER node
EXPOSE 3000
CMD ["sh", "deploy/start.sh"]
