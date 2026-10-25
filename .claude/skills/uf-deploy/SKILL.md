---
name: uf-deploy
description: テストに通った変更を main に入れて本番の Minecraft サーバー（denken-mc）に届け、届いたか・エラーなしで読み込まれたかを SSH で確かめて報告する手順。「main に入れて」「本番に反映して」と言われたとき、または uf-localtest に通った変更を入れるときに使う。
---

# 本番への反映

main に入れたものは、本番の systemd タイマー `skript-git-pull.timer` が 10 分以内に `git pull --ff-only` して `sk reload scripts` する。テストに通った変更は Claude の判断で main に入れてよい（2026-10-26 にユーザーが決めた）。入れたら必ず報告する。

## 手順

1. 入れる前の確認
   - `.sk` を変えたなら `uf-localtest` に通っている（通っていなければ先にそちら）
   - 秘密情報（トークン、RCON パスワード、playit のアドレス、Webhook URL）が差分に入っていない。リポジトリは公開
2. 早送りで入れる（マージコミットは作らない）:
   ```bash
   cd /f/Claude/skript-univfes2026-scripts && git fetch -q origin && git switch -q main && git merge --ff-only -q origin/main && git merge --ff-only <ブランチ> && git push -q origin main && git log -1 --oneline
   ```
   早送りできないときは、ブランチを main の上に載せ直してテストし直す
3. 次に反映される時刻:
   ```bash
   ssh -o BatchMode=yes denken@denken-mc "systemctl --user list-timers skript-git-pull.timer --no-pager | sed -n 2p"
   ```
4. 届くまで待つ（15 秒おきに見る。Bash は timeout を 720000 に）:
   ```bash
   for i in $(seq 1 45); do h=$(ssh -o BatchMode=yes denken@denken-mc "git -C /home/denken/workspace/paper1214/plugins/Skript/scripts log -1 --format=%h"); [ "$h" = "<短いハッシュ>" ] && break; sleep 15; done; echo "HEAD=$h"
   ```
5. 読み込みの結果:
   ```bash
   ssh -o BatchMode=yes denken@denken-mc "journalctl --user -u skript-git-pull.service --no-pager --since '-12 min' | grep -a 'Successfully\|完了\|rror\|Line [0-9]*:' | tail -10"
   ```
   - `Successfully reloaded all scripts.` が出ていれば成功。前からある警告（`uf_14_admintool.sk` 937 行、`uf_12_admin.sk` 35 行）は問題ない
   - エラーが出たら、すぐに直すか、main を元に戻す（`git revert` してから push）。どちらにしたかユーザーに伝える
6. ゲームの中で確かめられることは `uf-prod` の ClaudeBot で見る（新しいボタンが出るか、など。読むだけにする）
7. 報告: 入れたブランチ、main のハッシュ、本番に届いた時刻、読み込みの結果、ゲームで確かめたこと・確かめていないこと

## 注意

- 本番の `scripts` フォルダで直接ファイルを変えない（次の `git pull --ff-only` が止まる）
- 反映のスクリプトはユーザーの `~/.local/bin/update-skript-scripts.sh`。中に RCON のパスワードがあるので、中身を表示しない・ログに貼らない
