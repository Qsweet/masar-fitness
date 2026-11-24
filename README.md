# مسار الأبطال — منصة البيع الإلكتروني

موقع البيع المباشر والمدونة لنادي مسار الأبطال الرياضي (بريدة). الحالة والخطة في [`docs/PROGRESS.md`](docs/PROGRESS.md) و[`docs/ROADMAP.md`](docs/ROADMAP.md).

## التشغيل محليًا

المتطلبات: Node 22، pnpm 10، PostgreSQL 16 (أو Docker).

```bash
docker compose up -d db
cp .env.example apps/web/.env.local
cp .env.example packages/db/.env
pnpm install
pnpm db:migrate
pnpm --filter @masar/web dev
```

الموقع على http://localhost:3000 (العربية) و http://localhost:3000/en، ونقطة الصحة على `/api/health`.

## البنية

| المسار            | المحتوى                                                          |
| ----------------- | ---------------------------------------------------------------- |
| `apps/web`        | تطبيق Next.js: الموقع العام، ولاحقًا بوابة المشترك ولوحة الإدارة |
| `packages/domain` | منطق العمل بلا إطار (المال، التحقق، الأخطاء)                     |
| `packages/db`     | مخطط PostgreSQL وترحيلاته وعميل قاعدة البيانات                   |
| `docs`            | المواصفات والقرارات والتقدم                                      |

أوامر التحقق وقواعد العمل في [`CLAUDE.md`](CLAUDE.md).
