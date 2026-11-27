#!/usr/bin/env bash
# استرجاع نسخة احتياطية والتحقق منها (docs/BACKUP.md §6).
#
#   restore.sh [--snapshot ID] [--keep]
#       الافتراضي، وهو تجربة الاسترجاع: لقطة آخر نسخة ناجحة (last-success.json) أو المطلوبة. يتحقق من
#       المساحة الحرة، ثم يسترجع القاعدة إلى قاعدة جانبية جديدة والصور إلى مجلد جانبي،
#       ويتحقق من الترحيلات وعدد صفوف كل جدول ووجود ملفات كل صورة، ثم يحذف الجانبيين (إلا مع --keep).
#       لا يمس الموقع ولا قاعدته ولا صوره.
#   restore.sh --production [--snapshot ID] [--skip-safety-backup]
#       بعد التجربة نفسها ونجاحها، وفحص الترحيلات مقابل الكود، وبتأكيدين مكتوبين: نسخة أمان بلا تنظيف،
#       وصور اللقطة في مجلد مرحلي، ثم إيقاف الموقع، والقاعدة المسترجعة مكان قاعدة الإنتاج والصور
#       مكان الصور (السابقتان تبقيان بأسماء أخرى ولا تُحذفان)، ثم تشغيل الموقع. production.sh
# shellcheck source-path=SCRIPTDIR
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=lib.sh
. "$HERE/lib.sh"
# shellcheck source=jobs.sh
. "$HERE/jobs.sh"
# shellcheck source=production.sh
. "$HERE/production.sh"

SNAPSHOT=""
KEEP=no
PRODUCTION=no
SAFETY_BACKUP=yes
STAMP="$(date -u +%Y%m%d%H%M%S)"
SCRATCH_DB="${BACKUP_DB_NAME}_restore_${STAMP}"
WORK=""
SCRATCH_CREATED=no
# تقدير حجم القاعدة المسترجعة من حجم نسخة -Fc المضغوطة (البيانات والفهارس أكبر منها)
DUMP_EXPANSION="${BACKUP_DUMP_EXPANSION:-5}"
KIB=1024
# أسماء الملفات الناقصة المطبوعة في السجل؛ العدد الكامل في رسالة الفشل
MISSING_SHOWN=5

usage() {
  sed -n '2,14p' "${BASH_SOURCE[0]}" | sed 's/^# \{0,1\}//'
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
  production_exit "$code"
  if [ "$SCRATCH_CREATED" = yes ] && [ "$KEEP" = no ]; then
    db_sql postgres "DROP DATABASE IF EXISTS $SCRATCH_DB" || log "تعذّر حذف القاعدة الجانبية $SCRATCH_DB"
  fi
  if [ -n "$WORK" ] && [ "$KEEP" = no ]; then
    rm -rf "$WORK"
  fi
  finish_job "$code"
}

snapshot_ids() {
  restic_run -- snapshots --json --tag "$SNAPSHOT_TAG" | grep -o '"id":"[0-9a-f]\{64\}"' | cut -d '"' -f 4 || true
}

# اللقطة: المطلوبة ببادئتها، وإلا لقطة آخر نسخة ناجحة في السجل (لا «آخر لقطة»: نسخة أمان أو لقطة
# يدوية قد تكون أحدث)، وإلا آخر لقطة بالوسم. المخرَج معرّفها الكامل. (restic يرفض معرّفًا صريحًا مع
# تصفية الاسم RESTIC_HOST، فالبحث في القائمة.)
resolve_snapshot() {
  local ids id="" recorded
  ids="$(snapshot_ids)"
  if [ -n "$SNAPSHOT" ]; then
    id="$(printf '%s\n' "$ids" | grep "^$SNAPSHOT" || true)"
    [ "$(printf '%s\n' "$id" | grep -c . || true)" -le 1 ] || die "أكثر من لقطة تبدأ بـ$SNAPSHOT: اكتب محارف أكثر"
  else
    recorded="$(status_read last-success.json | json_field snapshot)"
    if [[ "$recorded" =~ ^[0-9a-f]{64}$ ]] && printf '%s\n' "$ids" | grep -qx "$recorded"; then
      id="$recorded"
    else
      log "لا لقطة نجاح مسجّلة في المستودع؛ آخر لقطة بالوسم $SNAPSHOT_TAG"
      id="$(printf '%s\n' "$ids" | tail -n 1)"
    fi
  fi
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

free_kib() { df -Pk "$1" | awk 'NR == 2 { print $4 }'; }
device_of() { stat -c %d "$1"; }

# مكان ملفات القاعدة (وحدة Docker على الخادم).
db_storage() {
  if [ "$BACKUP_RUNTIME" = local ]; then printf '%s' "$WORK"; else docker info -f '{{.DockerRootDir}}'; fi
}

# يرفض قبل إنشاء أي شيء إن لم تتسع المساحة: القاعدة ≈ نسخة -Fc × DUMP_EXPANSION، والصور ≤ حجم اللقطة
# المسترجعة كاملة؛ والإنتاج يضيف صورًا مرحلية في الوحدة.
check_space() {
  local id="$1" dump_bytes media_bytes db_need media_need db_path db_free work_free
  CURRENT_STEP=space
  dump_bytes="$(sed -n 's/.*"bytes": *\([0-9]*\).*/\1/p' "$WORK/manifest.json" | head -n 1)"
  [[ "$dump_bytes" =~ ^[0-9]+$ ]] || die "البيان بلا حجم النسخة"
  # --host "": معرّف صريح مع تصفية RESTIC_HOST مرفوض
  media_bytes="$(restic_run -- stats --json --mode restore-size --host "" "$id" | json_field total_size)"
  [[ "$media_bytes" =~ ^[0-9]+$ ]] || die "تعذّر حساب حجم اللقطة"
  db_need=$((dump_bytes * DUMP_EXPANSION / KIB + 1))
  media_need=$((media_bytes / KIB + 1))
  db_path="$(db_storage)"
  [ "$PRODUCTION" = no ] || db_need=$((db_need + media_need))
  db_free="$(free_kib "$db_path")"
  work_free="$(free_kib "$WORK")"
  if [ "$(device_of "$db_path")" = "$(device_of "$WORK")" ]; then
    db_need=$((db_need + media_need))
    media_need=0
  fi
  log "المساحة: يلزم ${db_need} KiB في $db_path (المتاح $db_free)، و${media_need} KiB في $WORK (المتاح $work_free)"
  [ "$db_free" -ge "$db_need" ] || die "المساحة الحرة لا تكفي في $db_path: يلزم ${db_need} KiB والمتاح ${db_free}"
  [ "$work_free" -ge "$media_need" ] || die "المساحة الحرة لا تكفي في $WORK: يلزم ${media_need} KiB والمتاح ${work_free}"
}

record_drill() {
  local id="$1" tables="$2" rows="$3" files="$4" now
  now="$(utc_now)"
  printf '{"format":%d,"kind":"drill","ok":true,"finishedAt":"%s","snapshot":"%s","mode":"scratch","tables":%s,"rows":%s,"mediaFiles":%s}\n' \
    "$STATUS_FORMAT" "$now" "$id" "$tables" "$rows" "$files" | status_write last-drill.json
  JOB_DONE=yes
}

restore_scratch() {
  local id="$1" files tables rows
  fetch_metadata "$id"
  check_space "$id"
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
  record_drill "$id" "$tables" "$rows" "$files"
}

main() {
  local id
  parse_args "$@"
  require_config
  JOB=drill
  trap_signals
  trap 'restore_exit $?' EXIT
  take_lock
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
