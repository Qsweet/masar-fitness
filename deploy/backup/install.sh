#!/usr/bin/env bash
# يثبّت مؤقتَي systemd للنسخ اليومي والفحص الأسبوعي (docs/BACKUP.md §8). تكراره آمن: يعيد كتابة
# الوحدات نفسها ويبقي الإزاحة العشوائية لهذا الخادم (FixedRandomDelay).
# يشترط إعداد deploy/.env ومستودعًا مهيّأ (backup.sh init) يُفتح بكلمة المرور.
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"

UNITS=(masar-backup.service masar-backup.timer masar-backup-check.service masar-backup-check.timer)

[ "$(id -u)" -eq 0 ] || die "شغّله كمستخدم root"
[ "$BACKUP_RUNTIME" = compose ] || die "التثبيت للخادم فقط"
require_config

log "1/3 صورة restic المثبّتة بالإصدار والبصمة"
compose --profile backup pull backup

log "2/3 المستودع يُفتح بكلمة المرور"
restic_run -- cat config >/dev/null || die "المستودع لا يُفتح: شغّل backup.sh init أولًا وتحقق من المفاتيح"

log "3/3 المؤقتان"
chmod 755 "$HERE/backup.sh" "$HERE/restore.sh" "$HERE/install.sh"
for unit in "${UNITS[@]}"; do
  install -m 644 "$HERE/systemd/$unit" "/etc/systemd/system/$unit"
done
systemctl daemon-reload
systemctl enable --now masar-backup.timer masar-backup-check.timer >/dev/null
systemctl list-timers 'masar-backup*' --no-pager
log "تم. أول دورة تلقائية في الموعد أعلاه؛ السجل: journalctl -u masar-backup.service"
