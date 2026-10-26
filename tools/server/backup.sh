#!/bin/sh
# ワールドとプラグインのデータのバックアップ（/home/denken/workspace/paper1214/backup.sh に置く）
#   mc-backup.timer が毎日 5:00 に動かす。手で動かすときは systemctl --user start mc-backup
#   サーバーが動いていれば、自動保存を止めて全部書き出してから固め、終わったら自動保存を戻す
#   保存先は /home/denken/workspace/backups/world-<日時>.tar.gz。新しいものから KEEP 個だけ残す
#   プラグインの設定には秘密の値（DiscordSRV のトークンなど）が入るので、このファイルはサーバーの外へ出さない
set -eu
SRV=/home/denken/workspace/paper1214
DST=/home/denken/workspace/backups
KEEP=7
LOG=$SRV/logs/latest.log
mkdir -p "$DST"

send() { screen -S mcserver -p 0 -X stuff "$1\r"; }
running=0
if screen -ls | grep -q "\.mcserver"; then running=1; fi

# 途中で失敗しても自動保存は戻す
trap 'if [ $running = 1 ]; then send "save-on"; fi' EXIT

if [ $running = 1 ]; then
  n=$(wc -l < "$LOG")
  send "save-off"
  send "save-all flush"
  i=0
  until tail -n +$((n + 1)) "$LOG" | grep -q "Saved the game"; do
    i=$((i + 1))
    if [ $i -ge 120 ]; then echo "保存が終わらない（120 秒）。バックアップをやめる"; exit 1; fi
    sleep 1
  done
fi

name="world-$(date +%Y%m%d-%H%M)"
# ワールド、プラグインのデータと設定（jar 本体は除く）、サーバーの設定ファイル
FILES="world world_nether world_the_end plugins config"
for f in server.properties bukkit.yml spigot.yml commands.yml help.yml permissions.yml ops.json whitelist.json banned-players.json banned-ips.json usercache.json run.sh; do
  if [ -e "$SRV/$f" ]; then FILES="$FILES $f"; fi
done
# shellcheck disable=SC2086
tar -C "$SRV" --exclude='*.jar' --exclude='plugins/.paper-remapped' --exclude='plugins/_unused' --exclude='plugins/spark' \
  -czf "$DST/$name.tar.gz.part" $FILES
mv "$DST/$name.tar.gz.part" "$DST/$name.tar.gz"
echo "バックアップしました: $DST/$name.tar.gz ($(du -h "$DST/$name.tar.gz" | cut -f1))"

# 古いものを消す（このスクリプトが作った world-*.tar.gz だけ）
ls -1t "$DST"/world-*.tar.gz | tail -n +$((KEEP + 1)) | while read -r f; do
  rm -f -- "$f"
  echo "古いバックアップを消しました: $f"
done
