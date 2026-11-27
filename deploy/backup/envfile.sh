# shellcheck shell=bash
# قراءة قيمة من deploy/.env كما يقرؤها docker compose، دون تنفيذ الملف (لا `source`: القيم ليست صدفة).
# يستوردها lib.sh. ما يقرؤه السكربت على المضيف يجب أن يطابق ما تراه حاوية restic، فالحالات التي يختلف
# فيها التفسير تُرفض برسالة بدل أن تُقرأ بمعنى آخر (docs/BACKUP.md §7):
#   KEY=value              كما هي، و`export KEY=value` كذلك
#   KEY=value # تعليق      التعليق بعد مسافة يُحذف، والمسافات في الطرفين
#   KEY='value'            حرفيًا (الطريقة الموصى بها لكل قيمة تُكتب يدويًا فيها $)
#   KEY="value"            بلا $ ولا \ (compose يوسّعهما)
#   $ في قيمة بلا تنصيص مفرد مرفوض: compose يعدّه متغيرًا فيصل إلى restic شيء آخر

trim_spaces() {
  local value="$1"
  value="${value#"${value%%[![:space:]]*}"}"
  printf '%s' "${value%"${value##*[![:space:]]}"}"
}

env_reject() {
  log "خطأ: $1 في deploy/.env: $2 (docs/BACKUP.md §7)"
  exit 1
}

# يفسّر الجزء بعد = من سطر .env.
parse_env_raw() {
  local key="$1" raw="$2" value
  case "$raw" in
    \'*)
      value="${raw#\'}"
      [[ "$value" == *\'* ]] || env_reject "$key" "علامة تنصيص مفردة بلا إغلاق"
      printf '%s' "${value%%\'*}"
      ;;
    \"*)
      value="${raw#\"}"
      [[ "$value" == *\"* ]] || env_reject "$key" "علامة تنصيص مزدوجة بلا إغلاق"
      value="${value%%\"*}"
      [[ "$value" != *[\$\\]* ]] || env_reject "$key" "فيها \$ أو \\ بين تنصيص مزدوج؛ اكتبها بين تنصيص مفرد '...'"
      printf '%s' "$value"
      ;;
    *)
      value="$(trim_spaces "${raw%%[[:space:]]#*}")"
      [[ "$value" != *\$* ]] || env_reject "$key" "فيها \$؛ اكتبها بين تنصيص مفرد '...'"
      printf '%s' "$value"
      ;;
  esac
}

# env_value <KEY>: القيمة، أو لا شيء إن غاب السطر. آخر سطر للمفتاح يغلب كما في compose.
env_value() {
  local key="$1" line
  if [ "$BACKUP_RUNTIME" = local ]; then
    printf '%s' "${!key:-}"
    return
  fi
  [ -r "$ENV_FILE" ] || die "لا أستطيع قراءة $ENV_FILE"
  line="$(grep -E "^[[:space:]]*(export[[:space:]]+)?${key}[[:space:]]*=" "$ENV_FILE" | tail -n 1)" || line=""
  [ -n "$line" ] || return 0
  parse_env_raw "$key" "$(trim_spaces "${line#*=}")"
}
