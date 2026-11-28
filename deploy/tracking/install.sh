#!/usr/bin/env bash
# يثبّت مؤقتَي القياس: المرسِل كل دقيقة والتفريغ اليومي (docs/DEPLOYMENT.md، القراران 88 و90).
# تكراره آمن: يعيد كتابة الوحدات نفسها. بلا منصة مفعّلة لا شيء في الطابور، فالتثبيت آمن قبل الإعداد.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
UNITS=(masar-tracking-dispatch.service masar-tracking-dispatch.timer
  masar-tracking-purge.service masar-tracking-purge.timer)

[ "$(id -u)" -eq 0 ] || { echo "شغّله كمستخدم root" >&2; exit 1; }
[ -f /opt/masar/deploy/.env ] || { echo "لا يوجد /opt/masar/deploy/.env" >&2; exit 1; }

for unit in "${UNITS[@]}"; do
  install -m 644 "$HERE/systemd/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now masar-tracking-dispatch.timer masar-tracking-purge.timer >/dev/null

echo "تجربة التفريغ الآن:"
systemctl start masar-tracking-purge.service
journalctl -u masar-tracking-purge.service -n 3 --no-pager
systemctl list-timers 'masar-tracking-*' --no-pager
echo "تم. سجل المرسِل: journalctl -u masar-tracking-dispatch.service"
