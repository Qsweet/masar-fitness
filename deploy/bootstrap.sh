#!/usr/bin/env bash
# تجهيز خادم معاينة مسار الأبطال (Ubuntu، كمستخدم root). يُشغَّل مرة واحدة، وتكراره آمن.
#  1) يثبّت git وDocker.
#  2) ينشئ مفتاح قراءة فقط للمستودع ويطبع جزءه العام لتضيفه في GitHub، وينتظر حتى يعمل.
#  3) ينسخ المستودع، ويولّد كلمة مرور القاعدة على الخادم نفسه (لا تغادره).
#  4) يشغّل الموقع، ويضبط تحديثًا تلقائيًا كل دقيقتين من الفرع المتتبَّع.
set -euo pipefail

REPO="git@github.com:Qsweet/masar-fitness.git"
BRANCH="${BRANCH:-main}"
DIR=/opt/masar
KEY=/root/.ssh/masar_deploy

say() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

say "1/5 تثبيت git وDocker"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq git curl ca-certificates openssl >/dev/null
if ! docker compose version >/dev/null 2>&1; then
  apt-get install -y -qq docker.io docker-compose-v2 >/dev/null 2>&1 || curl -fsSL https://get.docker.com | sh
fi
systemctl enable --now docker >/dev/null
docker compose version

say "2/5 مفتاح قراءة المستودع"
install -d -m 700 /root/.ssh
[ -f "$KEY" ] || ssh-keygen -q -t ed25519 -N "" -C "masar-preview-server" -f "$KEY"
grep -q "masar_deploy" /root/.ssh/config 2>/dev/null || cat >> /root/.ssh/config <<CFG
Host github.com
  IdentityFile $KEY
  IdentitiesOnly yes
CFG
ssh-keyscan -t ed25519 github.com 2>/dev/null >> /root/.ssh/known_hosts
until git ls-remote --heads "$REPO" >/dev/null 2>&1; do
  echo
  echo "أضف هذا المفتاح في GitHub (للقراءة فقط):"
  echo "  github.com/Qsweet/masar-fitness ← Settings ← Deploy keys ← Add deploy key"
  echo "  الاسم: masar-preview-server   ولا تفعّل Allow write access"
  echo
  cat "$KEY.pub"
  echo
  echo "أنتظر حتى يُضاف المفتاح… (أعيد المحاولة كل 15 ثانية)"
  sleep 15
done
echo "المستودع متاح."

say "3/5 نسخ المستودع"
if [ -d "$DIR/.git" ]; then
  git -C "$DIR" fetch --quiet origin "$BRANCH"
else
  git clone --quiet --branch "$BRANCH" "$REPO" "$DIR"
fi

say "4/5 الإعداد"
ENV_FILE="$DIR/deploy/.env"
if [ ! -f "$ENV_FILE" ]; then
  IP="$(curl -fsS https://api.ipify.org || hostname -I | awk '{print $1}')"
  HOST="${SITE_HOST:-$(echo "$IP" | tr . -).sslip.io}"
  umask 077
  cat > "$ENV_FILE" <<ENV
# أنشأه bootstrap.sh. سري: لا يُنسخ ولا يُرفع.
DB_PASSWORD=$(openssl rand -hex 24)
SITE_HOST=$HOST
SITE_URL=https://$HOST
# الفهرسة مغلقة: نسخة معاينة. لا تُفتح إلا على النطاق الرسمي وبأمر المالك.
SITE_INDEXABLE=false
# أسعار تجريبية للمعاينة. تُحذف هذه القيمة قبل إدخال أسعار النادي الحقيقية.
SEED_DEMO_DATA=yes
ENV
fi
grep -E "^SITE_URL=" "$ENV_FILE"

say "5/5 التشغيل والتحديث التلقائي"
chmod +x "$DIR/deploy/update.sh"
BRANCH="$BRANCH" "$DIR/deploy/update.sh" --force
install -m 644 "$DIR/deploy/masar-update.service" "$DIR/deploy/masar-update.timer" /etc/systemd/system/
mkdir -p /etc/systemd/system/masar-update.service.d
printf '[Service]\nEnvironment=BRANCH=%s\n' "$BRANCH" > /etc/systemd/system/masar-update.service.d/branch.conf
systemctl daemon-reload
systemctl enable --now masar-update.timer >/dev/null

URL="$(grep -E '^SITE_URL=' "$ENV_FILE" | cut -d= -f2)"
echo
echo "أنتظر جاهزية الموقع…"
for _ in $(seq 1 60); do
  if curl -fsS "$URL/api/health" >/dev/null 2>&1; then
    echo
    echo "تم. الموقع على: $URL"
    exit 0
  fi
  sleep 5
done
echo "الموقع لم يستجب بعد. السجلات:"
docker compose -f "$DIR/deploy/compose.yml" --env-file "$ENV_FILE" logs --tail 40
exit 1
