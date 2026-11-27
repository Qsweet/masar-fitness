#!/usr/bin/env bash
# نسخ احتياطي مشفر خارج الخادم للقاعدة وللصور المرفوعة (docs/BACKUP.md).
#
#   backup.sh init       ينشئ المستودع المشفر مرة واحدة (تكراره آمن)
#   backup.sh run        نسخة الآن، ثم الاحتفاظ والتنظيف (يشغّلها masar-backup.timer يوميًا)
#   backup.sh check      فحص سلامة جزء من البيانات (يشغّلها masar-backup-check.timer أسبوعيًا)
#   backup.sh snapshots  قائمة اللقطات
#
# يعمل كمستخدم root على الخادم. الإعداد كله من /opt/masar/deploy/.env.
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
# shellcheck source=jobs.sh
. "$HERE/jobs.sh"

usage() {
  sed -n '2,8p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 2
}

main() {
  local command="${1:-}"
  case "$command" in
    init)
      require_config
      take_lock
      do_init
      ;;
    run)
      trap 'finish_job $?' EXIT
      take_lock
      do_backup
      ;;
    check)
      trap 'finish_job $?' EXIT
      take_lock
      do_check
      ;;
    snapshots)
      require_config
      restic_run -- snapshots --tag "$SNAPSHOT_TAG"
      ;;
    *) usage ;;
  esac
}

main "$@"
