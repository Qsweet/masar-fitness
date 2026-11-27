#!/usr/bin/env bash
# استرجاع نسخة احتياطية والتحقق منها (docs/BACKUP.md §6).
#
#   restore.sh [--snapshot ID] [--keep]
#       الافتراضي، وهو تجربة الاسترجاع: يسترجع القاعدة إلى قاعدة جانبية جديدة والصور إلى مجلد جانبي،
#       ويتحقق من الترحيلات وعدد صفوف كل جدول ووجود ملفات كل صورة، ثم يحذف الجانبيين (إلا مع --keep).
#       لا يمس الموقع ولا قاعدته ولا صوره.
#   restore.sh --production [--snapshot ID] [--skip-safety-backup]
#       بعد التجربة نفسها ونجاحها، وبتأكيدين مكتوبين: نسخة أمان من الحالة الحالية، ثم إيقاف الموقع،
#       ثم القاعدة المسترجعة مكان قاعدة الإنتاج (القديمة تبقى باسم آخر ولا تُحذف)، والصور فوق
#       وحدة media-data، ثم تشغيل الموقع.
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
# shellcheck source=jobs.sh
. "$HERE/jobs.sh"

SNAPSHOT=""
KEEP=no
PRODUCTION=no
SAFETY_BACKUP=yes
STAMP="$(date -u +%Y%m%d%H%M%S)"
SCRATCH_DB="${BACKUP_DB_NAME}_restore_${STAMP}"
WORK=""
SCRATCH_CREATED=no
MEDIA_VOLUME=masar_media-data
# أسماء الملفات الناقصة المطبوعة في السجل؛ العدد الكامل في رسالة الفشل
MISSING_SHOWN=5

usage() {
  sed -n '2,12p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
  exit 2
}

parse_args() {
  while [ "$#" -gt 0 ]; do
    case "$1" in
      --snapshot)
        [ "$#" -ge 2 ] || usage
        SNAPSHOT="$2"
        shift
        ;;
      --keep) KEEP=yes ;;
      --production) PRODUCTION=yes ;;
      --skip-safety-backup) SAFETY_BACKUP=no ;;
      *) usage ;;
    esac
    shift
  done
  [ -z "$SNAPSHOT" ] || [[ "$SNAPSHOT" =~ ^[0-9a-f]{8,64}$ ]] || die "معرّف اللقطة: 8 إلى 64 محرفًا من 0-9a-f"
  [ "$PRODUCTION" = yes ] || [ "$SAFETY_BACKUP" = yes ] || die "--skip-safety-backup مع --production فقط"
  [ "$PRODUCTION" = no ] || [ "$KEEP" = no ] || die "--keep لتجربة الاسترجاع وحدها"
  # التأكيدان يُكتبان بيد المالك: لا يُشغَّل فوق الإنتاج من سكربت أو مؤقت
  [ "$PRODUCTION" = no ] || [ -t 0 ] || die "الاسترجاع فوق الإنتاج يحتاج طرفية تفاعلية"
}

restore_exit() {
  local code="$1"
  if [ "$SCRATCH_CREATED" = yes ] && [ "$KEEP" = no ]; then
    db_sql postgres "DROP DATABASE IF EXISTS $SCRATCH_DB" || log "تعذّر حذف القاعدة الجانبية $SCRATCH_DB"
  fi
  if [ -n "$WORK" ] && [ "$KEEP" = no ]; then
    rm -rf "$WORK"
  fi
  finish_job "$code"
}

# آخر لقطة بالوسم، أو اللقطة التي يبدأ معرّفها بالمطلوب؛ المخرَج معرّفها الكامل. (restic يرفض معرّفًا
# صريحًا مع تصفية الاسم RESTIC_HOST، فالبحث في القائمة.)
resolve_snapshot() {
  local ids id
  ids="$(restic_run -- snapshots --json --tag "$SNAPSHOT_TAG" | grep -o '"id":"[0-9a-f]\{64\}"' | cut -d '"' -f 4)" || ids=""
  if [ -n "$SNAPSHOT" ]; then
    ids="$(printf '%s\n' "$ids" | grep "^$SNAPSHOT")" || ids=""
    [ "$(printf '%s\n' "$ids" | grep -c .)" -le 1 ] || die "أكثر من لقطة تبدأ بـ$SNAPSHOT: اكتب محارف أكثر"
  fi
  id="$(printf '%s\n' "$ids" | tail -n 1)"
  [ -n "$id" ] || die "لا لقطة ${SNAPSHOT:-بالوسم $SNAPSHOT_TAG} في المستودع"
  printf '%s' "$id"
}

make_work() {
  if [ "$BACKUP_RUNTIME" = local ]; then
    : "${BACKUP_LOCAL_RESTORE:?local runtime needs BACKUP_LOCAL_RESTORE}"
    rm -rf "$BACKUP_LOCAL_RESTORE"
    install -d -m 700 "$BACKUP_LOCAL_RESTORE"
    printf '%s' "$BACKUP_LOCAL_RESTORE"
  else
    install -d -m 700 /var/tmp/masar-restore
    mktemp -d "/var/tmp/masar-restore/$STAMP.XXXXXX"
  fi
}

# يسترجع مجلد الصور من اللقطة إلى مجلد على المضيف.
restore_media_to() {
  local id="$1" host_dir="$2"
  mkdir -p "$host_dir"
  if [ "$BACKUP_RUNTIME" = local ]; then
    restic_run -- restore "$id:$SNAP_MEDIA" --target "$host_dir" >&2
  else
    restic_run "--volume=$host_dir:/restore" -- restore "$id:$SNAP_MEDIA" --target /restore >&2
  fi
}

# عدد صفوف كل جدول في القاعدة الجانبية بالترتيب نفسه، في استعلام واحد.
scratch_counts() {
  local query="" table expected
  while IFS=$'\t' read -r table expected; do
    [[ "$table" =~ ^[A-Za-z0-9_.\"]+$ ]] || die "اسم جدول غير متوقع في البيان: $table"
    [ -z "$query" ] || query+=" UNION ALL "
    query+="SELECT '${table//\'/\'\'}', count(*) FROM $table"
  done <"$WORK/row-counts.tsv"
  db_sql "$SCRATCH_DB" "$query" | tr '|' '\t'
}

verify_database() {
  CURRENT_STEP=verify_migrations
  db_migrations "$SCRATCH_DB" >"$WORK/migrations.restored"
  diff -u "$WORK/migrations.txt" "$WORK/migrations.restored" >&2 ||
    die "الترحيلات في القاعدة المسترجعة لا تطابق البيان"
  CURRENT_STEP=verify_rows
  scratch_counts >"$WORK/row-counts.restored"
  diff -u "$WORK/row-counts.tsv" "$WORK/row-counts.restored" >&2 ||
    die "عدد الصفوف في القاعدة المسترجعة لا يطابق البيان"
}

# كل صورة في القاعدة المسترجعة لها ملفا AVIF وWebP غير فارغين لكل عرض (ADMIN_A3_SLIDER §6.4).
verify_media() {
  local media="$1" path missing=0 checked=0 format
  while IFS= read -r path; do
    [ -n "$path" ] || continue
    for format in avif webp; do
      checked=$((checked + 1))
      if [ ! -s "$media/$path.$format" ]; then
        missing=$((missing + 1))
        [ "$missing" -gt "$MISSING_SHOWN" ] || log "ملف صورة ناقص: $path.$format"
      fi
    done
  done < <(db_sql "$SCRATCH_DB" "SELECT club_id || '/' || sha256 || '/w' || w FROM media_assets, unnest(variant_widths) AS w ORDER BY 1")
  [ "$missing" -eq 0 ] || die "$missing من $checked ملف صورة غير موجود في النسخة"
  printf '%s' "$checked"
}

fetch_metadata() {
  local id="$1" file
  CURRENT_STEP=manifest
  for file in manifest.json row-counts.tsv migrations.txt; do
    restic_run -- dump "$id" "$SNAP_DB/$file" >"$WORK/$file"
  done
}

restore_scratch() {
  local id="$1" files tables rows
  fetch_metadata "$id"
  CURRENT_STEP=restore_database
  valid_db_name "$SCRATCH_DB" || die "اسم قاعدة غير صالح: $SCRATCH_DB"
  db_sql postgres "CREATE DATABASE $SCRATCH_DB"
  SCRATCH_CREATED=yes
  restic_run -- dump "$id" "$SNAP_DB/$DUMP_FILE" | drain_after db_restore_into "$SCRATCH_DB"
  verify_database
  CURRENT_STEP=restore_media
  restore_media_to "$id" "$WORK/media"
  CURRENT_STEP=verify_media
  files="$(verify_media "$WORK/media")"
  tables="$(wc -l <"$WORK/row-counts.tsv" | tr -d ' ')"
  rows="$(awk -F '\t' '{ sum += $2 } END { print sum + 0 }' "$WORK/row-counts.tsv")"
  log "نجح التحقق. الجداول: $tables، الصفوف: $rows (مطابقة للبيان)، ملفات الصور: $files (كلها موجودة)"
  printf '{"format":%d,"kind":"drill","ok":true,"finishedAt":"%s","snapshot":"%s","mode":"%s","tables":%s,"rows":%s,"mediaFiles":%s}\n' \
    "$STATUS_FORMAT" "$(utc_now)" "$id" "$( [ "$PRODUCTION" = yes ] && echo production || echo scratch)" \
    "$tables" "$rows" "$files" | status_write last-drill.json
}

confirm() {
  local prompt="$1" expected="$2" answer
  printf '\n%s\nاكتب: %s\n> ' "$prompt" "$expected" >&2
  IFS= read -r answer || answer=""
  [ "$answer" = "$expected" ] || die "لم يُؤكَّد: لم يتغير شيء في الإنتاج"
}

confirm_production() {
  local id="$1"
  CURRENT_STEP=confirm
  log "اللقطة ${id:0:8} مسترجعة ومتحقق منها في $SCRATCH_DB."
  confirm "سيُستبدل موقع الإنتاج وقاعدته وصوره بهذه اللقطة. القاعدة الحالية تبقى باسم آخر." "RESTORE PRODUCTION"
  confirm "تأكيد ثانٍ: اكتب أول 8 محارف من معرّف اللقطة." "${id:0:8}"
}

app_stop() { [ "$BACKUP_RUNTIME" = local ] || compose stop app >&2 </dev/null; }
app_start() { [ "$BACKUP_RUNTIME" = local ] || compose up -d app >&2 </dev/null; }

# القاعدة المسترجعة المتحقق منها تأخذ اسم الإنتاج، والقديمة تبقى باسمها الجديد ولا تُحذف.
swap_database() {
  local previous="${BACKUP_DB_NAME}_before_restore_${STAMP}" exists
  valid_db_name "$previous" || die "اسم قاعدة غير صالح: $previous"
  exists="$(db_sql postgres "SELECT 1 FROM pg_database WHERE datname = '$BACKUP_DB_NAME'")"
  db_sql postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$BACKUP_DB_NAME', '$SCRATCH_DB') AND pid <> pg_backend_pid()" >/dev/null
  if [ "$exists" = 1 ]; then
    db_sql postgres "ALTER DATABASE $BACKUP_DB_NAME RENAME TO $previous"
    log "القاعدة السابقة محفوظة باسم $previous (تُحذف يدويًا بعد التأكد، docs/BACKUP.md §6.3)"
  fi
  db_sql postgres "ALTER DATABASE $SCRATCH_DB RENAME TO $BACKUP_DB_NAME"
  SCRATCH_CREATED=no
}

restore_production_media() {
  local id="$1"
  if [ "$BACKUP_RUNTIME" = local ]; then
    restic_run -- restore "$id:$SNAP_MEDIA" --target "$BACKUP_LOCAL_MEDIA" >&2
  else
    restic_run "--volume=$MEDIA_VOLUME:/restore-media" -- restore "$id:$SNAP_MEDIA" --target /restore-media >&2
  fi
}

restore_production() {
  local id="$1"
  confirm_production "$id"
  if [ "$SAFETY_BACKUP" = yes ]; then
    CURRENT_STEP=safety_backup
    log "نسخة أمان من الحالة الحالية قبل الاستبدال"
    BACKUP_LOCK_HELD=yes "$HERE/backup.sh" run || die "فشلت نسخة الأمان؛ لم يتغير شيء. (--skip-safety-backup إن كانت القاعدة الحالية تالفة)"
  fi
  CURRENT_STEP=swap
  app_stop
  swap_database
  CURRENT_STEP=production_media
  restore_production_media "$id"
  app_start
  log "تم الاسترجاع فوق الإنتاج من اللقطة ${id:0:8}"
}

main() {
  local id
  parse_args "$@"
  require_config
  take_lock
  JOB=drill
  trap 'restore_exit $?' EXIT
  CURRENT_STEP=snapshot
  id="$(resolve_snapshot)"
  log "اللقطة ${id:0:8} إلى القاعدة الجانبية $SCRATCH_DB"
  WORK="$(make_work)"
  restore_scratch "$id"
  if [ "$PRODUCTION" = yes ]; then
    restore_production "$id"
  elif [ "$KEEP" = yes ]; then
    log "باقيتان للفحص: القاعدة $SCRATCH_DB والمجلد $WORK"
  fi
}

main "$@"
