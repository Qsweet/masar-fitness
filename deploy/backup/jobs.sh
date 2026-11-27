# shellcheck shell=bash
# مهام النسخ الاحتياطي: النسخ اليومي، والفحص الأسبوعي، وتهيئة المستودع (docs/BACKUP.md §3–§5).
# يستوردها backup.sh وrestore.sh بعد lib.sh.

JOB=""
# تُعلَّم في آخر سطر من المهمة بعد نجاحها؛ مصيدة الخروج تحكم بها لا برمز الخروج (قتلٌ قد يخرج بصفر)
JOB_DONE=no
CURRENT_STEP=start
STAGE=""
# نطاق الفحص الأسبوعي الافتراضي: خُمس حزم البيانات تُقرأ وتُفك كل أسبوع
DEFAULT_CHECK_SUBSET="20%"
RESTIC_NO_REPOSITORY=10

cleanup_stage() {
  if [ -n "$STAGE" ]; then
    rm -rf "$STAGE"
    STAGE=""
  fi
}

number_or_zero() {
  if [[ "${1:-}" =~ ^[0-9]+$ ]]; then printf '%s' "$1"; else printf 0; fi
}

safe_token() {
  if [[ "${1:-}" =~ ^[0-9A-Za-z._-]{1,64}$ ]]; then printf '%s' "$1"; else printf unknown; fi
}

# إشارات الإيقاف (systemd يرسل TERM عند المهلة أو الإيقاف) تُنهي بالرمز المعتاد فتمر بمصيدة EXIT.
trap_signals() {
  trap 'exit 143' TERM
  trap 'exit 130' INT
  trap 'exit 129' HUP
}

record_failure() {
  local name="$1" now
  now="$(utc_now)"
  printf '{"format":%d,"kind":"%s","ok":false,"finishedAt":"%s","step":"%s"}\n' \
    "$STATUS_FORMAT" "$JOB" "$now" "$CURRENT_STEP" | status_write "$name" ||
    log "تعذّرت كتابة سجل الحالة"
}

# يُستدعى من مصيدة EXIT: يمسح النسخة المؤقتة، ويسجّل الفشل ويبلّغ المراقبة. المهمة ناجحة فقط إن
# بلغت آخرها (JOB_DONE)، مهما كان رمز الخروج.
finish_job() {
  local code="$1" name
  cleanup_stage
  [ "$JOB_DONE" = yes ] && return 0
  case "$JOB" in
    backup) name=last-run.json ;;
    check) name=last-check.json ;;
    drill) name=last-drill.json ;;
    *) return 0 ;;
  esac
  log "فشل $JOB في الخطوة $CURRENT_STEP (رمز الخروج $code)"
  record_failure "$name"
  # تجربة الاسترجاع يدوية: فشلها يظهر في اللوحة، ولا يُبلَّغ مراقب النسخ اليومية
  [ "$JOB" = drill ] || ping_monitor fail
}

app_version() {
  local version=""
  if [ "$BACKUP_RUNTIME" = local ]; then
    version="${APP_VERSION:-dev}"
  else
    version="$(compose exec -T app printenv APP_VERSION 2>/dev/null </dev/null)" ||
      version="$(git -C "$MASAR_DIR" rev-parse --short HEAD 2>/dev/null)" || version=""
  fi
  safe_token "$version"
}

# migrations.json: ["a","b"]؛ الأسماء من Prisma (أرقام وحروف وشرطة سفلية) وتُرفض غيرها.
migrations_json() {
  local first=1 name
  printf '['
  while IFS= read -r name; do
    [ -n "$name" ] || continue
    [[ "$name" =~ ^[0-9A-Za-z_]+$ ]] || die "اسم ترحيل غير متوقع: $name"
    [ "$first" -eq 1 ] || printf ','
    printf '"%s"' "$name"
    first=0
  done
  printf ']'
}

# البيان: الإصدار والترحيلات والوقت وبصمة النسخة. لا أسرار فيه.
write_manifest() {
  local stage="$1" migrations="$2" bytes sha tables rows server now version list
  bytes="$(stat -c %s "$stage/$DUMP_FILE")"
  sha="$(sha256sum "$stage/$DUMP_FILE" | cut -d ' ' -f 1)"
  tables="$(wc -l <"$stage/row-counts.tsv" | tr -d ' ')"
  rows="$(awk -F '\t' '{ sum += $2 } END { print sum + 0 }' "$stage/row-counts.tsv")"
  server="$(db_sql "$BACKUP_DB_NAME" 'SHOW server_version')"
  server="$(safe_token "${server%% *}")"
  now="$(utc_now)"
  version="$(app_version)"
  list="$(printf '%s\n' "$migrations" | migrations_json)"
  printf '{\n  "format": %d,\n  "createdAt": "%s",\n  "appVersion": "%s",\n  "database": "%s",\n' \
    "$STATUS_FORMAT" "$now" "$version" "$BACKUP_DB_NAME" >"$stage/manifest.json"
  printf '  "postgres": "%s",\n  "dump": { "file": "%s", "bytes": %s, "sha256": "%s" },\n' \
    "$server" "$DUMP_FILE" "$bytes" "$sha" >>"$stage/manifest.json"
  printf '  "tables": %s,\n  "rows": %s,\n  "migrations": %s\n}\n' \
    "$tables" "$rows" "$list" >>"$stage/manifest.json"
}

# نسخة القاعدة في الذاكرة، مقروءة كاملة (عدّ الصفوف)، بين قراءتين متطابقتين للترحيلات.
stage_database() {
  local before after
  CURRENT_STEP=stage
  STAGE="$(make_stage)"
  CURRENT_STEP=migrations
  before="$(db_migrations "$BACKUP_DB_NAME")"
  CURRENT_STEP=dump
  db_dump >"$STAGE/$DUMP_FILE"
  [ -s "$STAGE/$DUMP_FILE" ] || die "نسخة القاعدة فارغة"
  CURRENT_STEP=verify_dump
  db_dump_data <"$STAGE/$DUMP_FILE" | count_copy_rows >"$STAGE/row-counts.tsv"
  [ -s "$STAGE/row-counts.tsv" ] || die "نسخة القاعدة بلا جداول"
  CURRENT_STEP=migrations
  after="$(db_migrations "$BACKUP_DB_NAME")"
  [ "$before" = "$after" ] || die "تغيّرت الترحيلات أثناء النسخ (نشر متزامن)؛ تُعاد في الدورة التالية"
  printf '%s\n' "$after" >"$STAGE/migrations.txt"
  CURRENT_STEP=manifest
  write_manifest "$STAGE" "$after"
}

# do_backup [--no-retention]: بلا احتفاظ ولا تنظيف لنسخة الأمان قبل الاسترجاع فوق الإنتاج، فلا يحذف
# التنظيف اللقطة التي يُسترجع منها (لقطة اليوم نفسه تُستبدل بـkeep-daily).
do_backup() {
  local retention=yes output summary snapshot processed added repository record now version
  [ "${1:-}" != --no-retention ] || retention=no
  JOB=backup
  CURRENT_STEP=config
  require_config
  stage_database
  CURRENT_STEP=upload
  output="$(restic_run "$(stage_mount "$STAGE")" -- backup --json --tag "$SNAPSHOT_TAG" \
    --exclude "$SNAP_MEDIA/.restore-*" --exclude "$SNAP_MEDIA/.before-restore-*" "$SNAP_DB" "$SNAP_MEDIA")"
  summary="$(printf '%s\n' "$output" | grep '"message_type":"summary"' | tail -n 1)" || summary=""
  snapshot="$(printf '%s\n' "$summary" | json_field snapshot_id)"
  [[ "$snapshot" =~ ^[0-9a-f]{8,64}$ ]] || die "لم يُنشئ restic لقطة"
  processed="$(printf '%s\n' "$summary" | json_field total_bytes_processed)"
  added="$(printf '%s\n' "$summary" | json_field data_added)"
  cleanup_stage
  log "لقطة ${snapshot:0:8}: $(number_or_zero "$processed") بايت، أُضيف $(number_or_zero "$added")"
  if [ "$retention" = yes ]; then
    CURRENT_STEP=retention
    restic_run -- forget --tag "$SNAPSHOT_TAG" --keep-daily "$KEEP_DAILY" \
      --keep-weekly "$KEEP_WEEKLY" --keep-monthly "$KEEP_MONTHLY" --prune >&2
  else
    log "بلا احتفاظ ولا تنظيف في هذه الدورة (نسخة أمان)"
  fi
  CURRENT_STEP=stats
  repository="$(restic_run -- stats --json --mode raw-data | json_field total_size)" || repository=""
  CURRENT_STEP=status
  now="$(utc_now)"
  version="$(app_version)"
  processed="$(number_or_zero "$processed")"
  added="$(number_or_zero "$added")"
  repository="$(number_or_zero "$repository")"
  record="$(printf '{"format":%d,"kind":"backup","ok":true,"finishedAt":"%s","snapshot":"%s",' \
    "$STATUS_FORMAT" "$now" "$snapshot")"
  record+="$(printf '"bytesProcessed":%s,"bytesAdded":%s,"repositoryBytes":%s,"appVersion":"%s"}' \
    "$processed" "$added" "$repository" "$version")"
  printf '%s\n' "$record" | status_write last-success.json
  printf '%s\n' "$record" | status_write last-run.json
  JOB_DONE=yes
  ping_monitor ok
  log "تمت النسخة الاحتياطية"
}

check_subset() {
  local subset
  subset="$(env_value BACKUP_CHECK_SUBSET)"
  subset="${subset:-$DEFAULT_CHECK_SUBSET}"
  [[ "$subset" =~ ^([0-9]{1,3}%|[0-9]+/[0-9]+|[0-9]+[KMGT])$ ]] || die "BACKUP_CHECK_SUBSET غير صالح: $subset"
  printf '%s' "$subset"
}

do_check() {
  local subset now
  JOB=check
  CURRENT_STEP=config
  require_config
  subset="$(check_subset)"
  CURRENT_STEP=check
  restic_run -- check --read-data-subset="$subset" >&2
  now="$(utc_now)"
  printf '{"format":%d,"kind":"check","ok":true,"finishedAt":"%s","subset":"%s"}\n' \
    "$STATUS_FORMAT" "$now" "$subset" | status_write last-check.json
  JOB_DONE=yes
  ping_monitor ok
  log "نجح فحص السلامة ($subset من البيانات)"
}

# ينشئ المستودع المشفر إن لم يوجد؛ تكراره آمن.
do_init() {
  local code=0
  require_config
  restic_run -- cat config >/dev/null 2>&1 || code=$?
  if [ "$code" -eq 0 ]; then
    log "المستودع موجود ويُفتح بكلمة المرور: لا شيء يُنشأ"
    return 0
  fi
  [ "$code" -eq "$RESTIC_NO_REPOSITORY" ] ||
    die "تعذّر فتح المستودع (رمز restic $code): تحقق من RESTIC_REPOSITORY وكلمة المرور ومفاتيح المزوّد"
  restic_run -- init >&2
  log "أُنشئ المستودع المشفر"
}
