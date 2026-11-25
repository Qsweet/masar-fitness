#!/bin/sh
# إقلاع الحاوية: ترحيلات القاعدة أولًا ثم الموقع. أي خطأ يوقف الإقلاع.
set -eu

pnpm --filter @masar/db migrate:deploy

# البيانات التجريبية للمعاينة فقط، ولا تعمل إلا بالقيمة yes صراحةً (لا تُضبط على قاعدة إنتاج أبدًا)
if [ "${SEED_DEMO_DATA:-}" = "yes" ]; then
  pnpm --filter @masar/db seed:demo
fi

cd apps/web
exec pnpm exec next start --hostname 0.0.0.0 --port "${PORT:-3000}"
