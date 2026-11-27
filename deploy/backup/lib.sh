# shellcheck shell=bash
# shellcheck source-path=SCRIPTDIR
# shellcheck disable=SC2034 # ثوابت يستعملها jobs.sh وrestore.sh بعد الاستيراد
# مكتبة النسخ الاحتياطي (docs/BACKUP.md). يستوردها backup.sh وrestore.sh، ولا تُشغَّل وحدها.
#
# بيئتا تشغيل بالواجهة نفسها:
#   compose (الافتراضي، الخادم): القاعدة بـ`docker compose exec db`، وrestic من صورته الرسمية المثبّتة
#     بخدمة `backup` في deploy/compose.yml، وسجل الحالة في وحدة `backup-status`.
#   local (الاختبار فقط): أدوات PostgreSQL وrestic على الجهاز نفسه، بمتغيرات PG* وRESTIC_* من البيئة.

# استبدال الأوامر يرث `set -e`: فشل داخل $(...) يوقف السكربت لا يُبتلع
shopt -s inherit_errexit

MASAR_DIR="${MASAR_DIR:-/opt/masar}"
ENV_FILE="${MASAR_ENV_FILE:-$MASAR_DIR/deploy/.env}"
BACKUP_RUNTIME="${BACKUP_RUNTIME:-compose}"
BACKUP_DB_NAME="${BACKUP_DB_NAME:-masar}"
# في /run (لـroot وحده، يُمحى عند الإقلاع). update.sh يتخطى دورته ما دام ممسوكًا.
LOCK_FILE="${BACKUP_LOCK_FILE:-/run/masar-backup.lock}"
# انتظار القفل: دورة أخرى (نسخ أو فحص أو استرجاع) تعمل الآن. يُقصَّر في الاختبار وحده.
LOCK_WAIT_SECONDS="${BACKUP_LOCK_WAIT_SECONDS:-1800}"
STAGE_PREFIX=/dev/shm/masar-backup.
# الاحتفاظ (docs/BACKUP.md §4)
KEEP_DAILY=14
KEEP_WEEKLY=8
KEEP_MONTHLY=12
SNAPSHOT_TAG=masar
STATUS_FORMAT=1
DUMP_FILE=masar.dump
PING_TIMEOUT_SECONDS=10

case "$BACKUP_RUNTIME" in
  compose)
    SNAP_DB=/backup/db
    SNAP_MEDIA=/backup/media
    ;;
  local)
    : "${BACKUP_LOCAL_STAGE:?local runtime needs BACKUP_LOCAL_STAGE}"
    : "${BACKUP_LOCAL_MEDIA:?local runtime needs BACKUP_LOCAL_MEDIA}"
    : "${BACKUP_STATUS_DIR:?local runtime needs BACKUP_STATUS_DIR}"
    SNAP_DB="$BACKUP_LOCAL_STAGE"
    SNAP_MEDIA="$BACKUP_LOCAL_MEDIA"
    ;;
  *)
    echo "BACKUP_RUNTIME must be compose or local" >&2
    exit 2
    ;;
esac

log() { printf '%s %s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$*" >&2; }
die() {
  log "خطأ: $*"
  exit 1
}
utc_now() { date -u +%Y-%m-%dT%H:%M:%SZ; }

HERE_LIB="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=envfile.sh
. "$HERE_LIB/envfile.sh"

require_config() {
  local key value
  for key in RESTIC_REPOSITORY RESTIC_PASSWORD; do
    value="$(env_value "$key")"
    [ -n "$value" ] || die "$key غير مكتوب في deploy/.env (docs/BACKUP.md §7)"
  done
}

compose() {
  docker compose -f "$MASAR_DIR/deploy/compose.yml" --env-file "$ENV_FILE" "$@"
}

# قفل واحد لكل عمليات النسخ والفحص والاسترجاع: لا تعمل اثنتان معًا.
take_lock() {
  # عملية فرعية لمن يمسك القفل (نسخة الأمان قبل الاسترجاع فوق الإنتاج) ترث واصفه
  [ "${BACKUP_LOCK_HELD:-}" = yes ] && return 0
  CURRENT_STEP=lock
  (umask 077 && : >>"$LOCK_FILE")
  exec 9>>"$LOCK_FILE"
  flock -w "$LOCK_WAIT_SECONDS" 9 || die "عملية نسخ أو استرجاع أخرى تعمل الآن (القفل $LOCK_FILE)"
  remove_stale_stages
}

# نسخ قاعدة صريحة في الذاكرة تركتها دورة قُتلت (SIGKILL، انقطاع): تحت القفل لا يملكها أحد الآن.
remove_stale_stages() {
  local stale
  [ "$BACKUP_RUNTIME" = compose ] || return 0
  for stale in "$STAGE_PREFIX"*; do
    [ -d "$stale" ] || continue
    rm -rf "$stale"
    log "حُذفت نسخة مؤقتة متروكة: $stale"
  done
}

# ---------- القاعدة ----------

valid_db_name() { [[ "$1" =~ ^[a-z][a-z0-9_]{0,62}$ ]]; }

# db_sql <database> <sql>: نتيجة بلا ترويسة، عمود في كل سطر مفصول بـ|.
db_sql() {
  local db="$1" sql="$2"
  if [ "$BACKUP_RUNTIME" = local ]; then
    psql -X -q -At -v ON_ERROR_STOP=1 -d "$db" -c "$sql" </dev/null
  else
    compose exec -T db psql -X -q -At -v ON_ERROR_STOP=1 -U masar -d "$db" -c "$sql" </dev/null
  fi
}

# نسخة القاعدة بصيغة pg_dump المخصصة (-Fc، مضغوطة) إلى stdout.
db_dump() {
  if [ "$BACKUP_RUNTIME" = local ]; then
    pg_dump -Fc -d "$BACKUP_DB_NAME" </dev/null
  else
    compose exec -T db pg_dump -Fc -U masar -d "$BACKUP_DB_NAME" </dev/null
  fi
}

# يقرأ نسخة -Fc من stdin ويكتب بياناتها نصًا (COPY) إلى stdout: قراءة كاملة للملف تثبت أنه سليم.
db_dump_data() {
  if [ "$BACKUP_RUNTIME" = local ]; then
    pg_restore --data-only -f -
  else
    compose exec -T db pg_restore --data-only -f -
  fi
}

# يسترجع نسخة -Fc من stdin إلى قاعدة موجودة، في معاملة واحدة تتوقف عند أول خطأ.
db_restore_into() {
  local db="$1"
  local args=(--no-owner --no-privileges --exit-on-error --single-transaction -d "$db")
  if [ "$BACKUP_RUNTIME" = local ]; then
    pg_restore "${args[@]}"
  else
    compose exec -T db pg_restore -U masar "${args[@]}"
  fi
}

# drain_after <أمر...>: يشغّل الأمر على stdin ثم يقرأ ما بقي منه. pg_restore يقف عند آخر ما يحتاجه
# من النسخة، فبلا هذا يموت الكاتب قبله في الأنبوب بـSIGPIPE ويُحسب الاسترجاع فاشلًا.
drain_after() {
  local code=0
  "$@" || code=$?
  cat >/dev/null
  return "$code"
}

# أسماء الترحيلات المطبَّقة، واحد في كل سطر.
db_migrations() {
  db_sql "$1" "SELECT migration_name FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL ORDER BY migration_name"
}

# يعدّ صفوف كل جدول من نص COPY: سطر لكل صف (السطر الجديد داخل قيمة يُكتب \n). المخرَج: «جدول<TAB>عدد».
count_copy_rows() {
  awk '
    /^COPY / { table = $2; rows = 0; inside = 1; next }
    inside && $0 == "\\." { printf "%s\t%d\n", table, rows; inside = 0; next }
    inside { rows++ }
  '
}

# ---------- restic ----------

# restic_run [--volume=host:container[:ro]]... -- <وسائط restic>
# stdin مغلق دائمًا: `docker compose run` و`exec` يقرآن الطرفية، فيبتلعان تأكيدات restore.sh بعدهما.
restic_run() {
  local mounts=()
  while [ "$#" -gt 0 ] && [ "$1" != "--" ]; do
    mounts+=("$1")
    shift
  done
  [ "${1:-}" = "--" ] && shift
  if [ "$BACKUP_RUNTIME" = local ]; then
    "${RESTIC_BIN:-restic}" "$@" </dev/null
  else
    compose run --rm -T --no-deps "${mounts[@]}" backup "$@" </dev/null
  fi
}

# يستخرج حقلًا نصيًا أو رقميًا من سطر JSON مسطّح (مخرجات restic --json)، بلا jq على الخادم.
json_field() {
  local field="$1"
  sed -n "s/.*\"${field}\":\"\{0,1\}\([^\",}]*\)\"\{0,1\}[,}].*/\1/p" | tail -n 1
}

# ---------- سجل الحالة ----------

# status_read <name>: نص ملف من السجل، أو لا شيء إن غاب.
status_read() {
  local name="$1"
  if [ "$BACKUP_RUNTIME" = local ]; then
    cat "$BACKUP_STATUS_DIR/$name" 2>/dev/null || true
  else
    compose run --rm -T --no-deps --entrypoint cat backup "/status/$name" </dev/null 2>/dev/null || true
  fi
}

# status_write <name>: يكتب JSON من stdin ذريًا إلى مجلد الحالة الذي يقرؤه الموقع.
status_write() {
  local name="$1"
  if [ "$BACKUP_RUNTIME" = local ]; then
    mkdir -p "$BACKUP_STATUS_DIR"
    cat >"$BACKUP_STATUS_DIR/.tmp.$name"
    mv "$BACKUP_STATUS_DIR/.tmp.$name" "$BACKUP_STATUS_DIR/$name"
  else
    # shellcheck disable=SC2016 # يتوسّع داخل الحاوية لا هنا
    compose run --rm -T --no-deps --entrypoint sh backup -c \
      'umask 022 && cat > "/status/.tmp.$1" && mv "/status/.tmp.$1" "/status/$1"' sh "$name"
  fi
}

# نبضة اختيارية لخدمة مراقبة بنمط healthchecks.io: الرابط عند النجاح، و/fail عند الفشل. الرابط سر
# (من يعرفه يزيّف النبضة)، فيُمرَّر لـcurl من stdin بملف إعداده (-K -) لا وسيطًا يظهر في قائمة العمليات.
ping_monitor() {
  local outcome="$1" url
  url="$(env_value BACKUP_PING_URL)"
  [ -n "$url" ] || return 0
  if [[ ! "$url" =~ ^https://[^[:space:]\"]+$ ]]; then
    log "BACKUP_PING_URL يجب أن يبدأ بـhttps:// بلا مسافات ولا علامات تنصيص؛ لم تُرسل النبضة"
    return 0
  fi
  [ "$outcome" = ok ] || url="${url%/}/fail"
  printf 'url = "%s"\n' "$url" |
    curl -fsS -m "$PING_TIMEOUT_SECONDS" --retry 3 -o /dev/null -K - ||
    log "تعذّر إرسال النبضة إلى المراقبة"
}

# مجلد مؤقت في الذاكرة (tmpfs) لنسخة القاعدة: النص الصريح لا يُكتب على القرص.
make_stage() {
  if [ "$BACKUP_RUNTIME" = local ]; then
    rm -rf "$BACKUP_LOCAL_STAGE"
    install -d -m 700 "$BACKUP_LOCAL_STAGE"
    printf '%s' "$BACKUP_LOCAL_STAGE"
    return
  fi
  [ "$(findmnt -n -o FSTYPE -T /dev/shm 2>/dev/null | tail -n 1)" = tmpfs ] || die "/dev/shm ليس tmpfs: لا أكتب نسخة القاعدة على القرص"
  mktemp -d "${STAGE_PREFIX}XXXXXX"
}

# وسيط تركيب مجلد النسخة في حاوية restic للقراءة فقط (بيئة الخادم).
stage_mount() { printf -- '--volume=%s:%s:ro' "$1" "$SNAP_DB"; }
