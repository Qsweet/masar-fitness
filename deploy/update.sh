#!/usr/bin/env bash
# يسحب آخر نسخة من الفرع المتتبَّع، ويعيد البناء والتشغيل فقط إن تغيّر شيء.
# تشغّله مهمة systemd كل دقيقتين، ويمكن تشغيله يدويًا. لا يعمل منه نسختان في الوقت نفسه.
set -euo pipefail

DIR=/opt/masar
BRANCH="${BRANCH:-main}"
COMPOSE=(docker compose -f "$DIR/deploy/compose.yml" --env-file "$DIR/deploy/.env")

exec 9>/var/lock/masar-update.lock
flock -n 9 || exit 0

cd "$DIR"
git fetch --quiet origin "$BRANCH"
current="$(git rev-parse HEAD)"
target="$(git rev-parse "origin/$BRANCH")"
running="$("${COMPOSE[@]}" ps --status running --quiet app 2>/dev/null || true)"

if [ "$current" = "$target" ] && [ -n "$running" ] && [ "${1:-}" != "--force" ]; then
  exit 0
fi

git reset --quiet --hard "$target"
export APP_VERSION
APP_VERSION="$(git rev-parse --short HEAD)"
echo "$(date -Is) deploying $APP_VERSION"
"${COMPOSE[@]}" up -d --build --remove-orphans
docker image prune -f >/dev/null
