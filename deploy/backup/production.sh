# shellcheck shell=bash
# shellcheck disable=SC2034 # JOB وSCRATCH_CREATED تقرؤهما مصيدة restore.sh
# الاسترجاع فوق الإنتاج (docs/BACKUP.md §6.2). يستوردها restore.sh بعد نجاح التجربة الجانبية.
# لا يحذف شيئًا: القاعدة السابقة تبقى باسم آخر، والصور السابقة في مجلد جانبي داخل الوحدة نفسها.
# أي فشل بعد إيقاف الموقع: يعيد تشغيله، ويطبع أوامر الرجوع بالأسماء الدقيقة (production_exit).

PROD_STARTED=no
PROD_DONE=no
APP_STOPPED=no
UPDATE_TIMER_STOPPED=no
DB_RENAMED=no
DB_SWAPPED=no
MEDIA_STAGED=no
MEDIA_SWAPPED=no
PREVIOUS_DB=""
MEDIA_VOLUME=masar_media-data

# تبديل محتوى مجلد الصور بمجلد مرحلي في الوحدة نفسها (نقل لا نسخ، على نظام الملفات نفسه). المداخل
# المنقّطة (مجلدات استرجاع سابقة) لا تُنقل في الاتجاهين.
# shellcheck disable=SC2016 # يتوسّع في sh الهدف
MEDIA_SWAP_SH='set -eu
cd "$1"
mkdir -p ".restore-$2"
mkdir ".before-restore-$2"
find . -mindepth 1 -maxdepth 1 ! -name ".*" -exec mv {} ".before-restore-$2/" \;
find ".restore-$2" -mindepth 1 -maxdepth 1 ! -name ".*" -exec mv {} . \;
rm -rf ".restore-$2"'

media_root() {
  if [ "$BACKUP_RUNTIME" = local ]; then printf '%s' "$BACKUP_LOCAL_MEDIA"; else printf /restore-media; fi
}

# media_sh <script>: سكربت sh على وحدة الصور (في حاوية restic على الخادم) بالوسيطين الجذر والوقت.
media_sh() {
  local script="$1" root
  root="$(media_root)"
  if [ "$BACKUP_RUNTIME" = local ]; then
    sh -c "$script" sh "$root" "$STAMP" </dev/null
  else
    compose run --rm -T --no-deps --entrypoint sh "--volume=$MEDIA_VOLUME:/restore-media" backup \
      -c "$script" sh "$root" "$STAMP" </dev/null
  fi
}

# الترحيلات في اللقطة مقابل الكود الحالي: ترحيل لا يعرفه الكود يرفض (قاعدة من إصدار أحدث)، وترحيل
# ناقص في اللقطة يُنبَّه إليه (يطبّقه إقلاع الموقع بعد الاسترجاع).
check_migrations() {
  local dir="${BACKUP_MIGRATIONS_DIR:-$MASAR_DIR/packages/db/prisma/migrations}" known unknown newer
  CURRENT_STEP=migrations_check
  [ -d "$dir" ] || die "لا أجد مجلد الترحيلات $dir"
  known="$(find "$dir" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' | sort)"
  unknown="$(comm -23 <(sort -u "$WORK/migrations.txt") <(printf '%s\n' "$known"))"
  [ -z "$unknown" ] || die "في اللقطة ترحيلات لا يعرفها الكود الحالي (حدّث الكود أولًا): $(printf '%s ' "$unknown")"
  newer="$(comm -13 <(sort -u "$WORK/migrations.txt") <(printf '%s\n' "$known"))"
  [ -z "$newer" ] || log "تنبيه: اللقطة أقدم من الكود؛ تُطبَّق عند إقلاع الموقع: $(printf '%s ' "$newer")"
}

confirm() {
  local prompt="$1" expected="$2" answer
  printf '\n%s\nاكتب: %s\n> ' "$prompt" "$expected" >&2
  IFS= read -r answer || answer=""
  if [ "$answer" != "$expected" ]; then
    log "لم يُؤكَّد: لم يتغير شيء في الإنتاج"
    exit 1
  fi
}

update_timer_stop() {
  [ "$BACKUP_RUNTIME" = compose ] || return 0
  if systemctl is-active --quiet masar-update.timer 2>/dev/null; then
    systemctl stop masar-update.timer
    UPDATE_TIMER_STOPPED=yes
  fi
}

update_timer_start() {
  [ "$UPDATE_TIMER_STOPPED" = yes ] || return 0
  systemctl start masar-update.timer || log "تعذّر تشغيل masar-update.timer: systemctl start masar-update.timer"
  UPDATE_TIMER_STOPPED=no
}

app_stop() {
  APP_STOPPED=yes
  [ "$BACKUP_RUNTIME" = local ] || compose stop app >&2 </dev/null
}

app_start() {
  [ "$BACKUP_RUNTIME" = local ] || compose up -d app >&2 </dev/null
  APP_STOPPED=no
}

# صور اللقطة في مجلد مرحلي داخل الوحدة، قبل إيقاف الموقع.
stage_production_media() {
  local id="$1" root
  CURRENT_STEP=stage_media
  root="$(media_root)"
  if [ "$BACKUP_RUNTIME" = local ]; then
    restic_run -- restore "$id:$SNAP_MEDIA" --target "$root/.restore-$STAMP" >&2
  else
    restic_run "--volume=$MEDIA_VOLUME:/restore-media" -- \
      restore "$id:$SNAP_MEDIA" --target "/restore-media/.restore-$STAMP" >&2
  fi
  MEDIA_STAGED=yes
}

swap_database() {
  local exists
  CURRENT_STEP=swap_database
  PREVIOUS_DB="${BACKUP_DB_NAME}_before_restore_${STAMP}"
  valid_db_name "$PREVIOUS_DB" || die "اسم قاعدة غير صالح: $PREVIOUS_DB"
  exists="$(db_sql postgres "SELECT 1 FROM pg_database WHERE datname = '$BACKUP_DB_NAME'")"
  db_sql postgres "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ('$BACKUP_DB_NAME', '$SCRATCH_DB') AND pid <> pg_backend_pid()" >/dev/null
  if [ "$exists" = 1 ]; then
    db_sql postgres "ALTER DATABASE $BACKUP_DB_NAME RENAME TO $PREVIOUS_DB"
    DB_RENAMED=yes
  fi
  db_sql postgres "ALTER DATABASE $SCRATCH_DB RENAME TO $BACKUP_DB_NAME"
  DB_SWAPPED=yes
}

psql_hint() {
  if [ "$BACKUP_RUNTIME" = local ]; then
    printf "psql -d postgres -c '%s'" "$1"
  else
    printf "docker compose -f %s/deploy/compose.yml --env-file %s exec db psql -U masar -d postgres -c '%s'" \
      "$MASAR_DIR" "$ENV_FILE" "$1"
  fi
}

# أوامر الرجوع إلى ما قبل الاسترجاع بالأسماء الدقيقة لما تغيّر فعلًا.
print_rollback() {
  log "للرجوع إلى ما قبل الاسترجاع (بالترتيب، والموقع موقوف: compose stop app):"
  if [ "$DB_SWAPPED" = yes ]; then
    log "  $(psql_hint "ALTER DATABASE $BACKUP_DB_NAME RENAME TO $SCRATCH_DB")"
  fi
  if [ "$DB_RENAMED" = yes ]; then
    log "  $(psql_hint "ALTER DATABASE $PREVIOUS_DB RENAME TO $BACKUP_DB_NAME")"
  fi
  if [ "$MEDIA_SWAPPED" = yes ]; then
    log "  الصور السابقة في .before-restore-$STAMP داخل وحدة $MEDIA_VOLUME: تُعاد مكانها بنقل محتواها إلى جذر الوحدة"
  elif [ "$MEDIA_STAGED" = yes ]; then
    log "  الصور لم تُبدَّل؛ المجلد المرحلي .restore-$STAMP في الوحدة يمكن حذفه"
  fi
}

# مصيدة الخروج في وضع الإنتاج: لا حذف أبدًا. فشل بعد إيقاف الموقع ⇒ تشغيله وأوامر الرجوع.
production_exit() {
  [ "$PROD_STARTED" = yes ] || return 0
  if [ "$PROD_DONE" != yes ]; then
    log "توقف الاسترجاع فوق الإنتاج في الخطوة $CURRENT_STEP"
    if [ "$DB_RENAMED" = yes ] || [ "$DB_SWAPPED" = yes ] || [ "$MEDIA_STAGED" = yes ]; then
      print_rollback
    fi
    if [ "$APP_STOPPED" = yes ]; then
      app_start || log "تعذّر تشغيل الموقع: compose up -d app"
    fi
  fi
  update_timer_start
}

restore_production() {
  local id="$1" now
  check_migrations
  log "اللقطة ${id:0:8} مسترجعة ومتحقق منها في $SCRATCH_DB."
  # رفض التأكيد ليس فشلًا في التجربة: سُجّلت ناجحة قبل هذا
  JOB=""
  confirm "سيُستبدل موقع الإنتاج وقاعدته وصوره بهذه اللقطة. القاعدة والصور الحالية تبقى بأسماء أخرى." "RESTORE PRODUCTION"
  confirm "تأكيد ثانٍ: اكتب أول 8 محارف من معرّف اللقطة." "${id:0:8}"
  # بعد التأكيد لا تُحذف القاعدة المسترجعة أبدًا، ولا شيء غيرها
  SCRATCH_CREATED=no
  PROD_STARTED=yes
  update_timer_stop
  if [ "$SAFETY_BACKUP" = yes ]; then
    CURRENT_STEP=safety_backup
    log "نسخة أمان من الحالة الحالية قبل الاستبدال (بلا تنظيف)"
    BACKUP_LOCK_HELD=yes "$HERE/backup.sh" run --no-retention ||
      die "فشلت نسخة الأمان؛ لم يتغير شيء. (--skip-safety-backup إن كانت القاعدة الحالية تالفة)"
  fi
  stage_production_media "$id"
  CURRENT_STEP=stop_app
  app_stop
  swap_database
  CURRENT_STEP=swap_media
  media_sh "$MEDIA_SWAP_SH"
  MEDIA_SWAPPED=yes
  CURRENT_STEP=start_app
  app_start
  PROD_DONE=yes
  now="$(utc_now)"
  printf '{"format":%d,"kind":"drill","ok":true,"finishedAt":"%s","snapshot":"%s","mode":"production"}\n' \
    "$STATUS_FORMAT" "$now" "$id" | status_write last-drill.json
  log "تم الاسترجاع فوق الإنتاج من اللقطة ${id:0:8}. القاعدة السابقة: $PREVIOUS_DB، والصور السابقة: .before-restore-$STAMP"
}
