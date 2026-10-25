---
name: uf-prod
description: 本番の Minecraft サーバー（denken-mc）を SSH で調べたり、コンソールにコマンドを送ったり、ボット ClaudeBot でゲームに入って管理者ツールを操作・確認したりする手順。本番のログ・設定・状態を見るとき、本番のゲームの中を確かめるときに使う。
---

# 本番のサーバーとゲーム

ユーザーが許した範囲（2026-10-26）: SSH で直接入ってよい、ClaudeBot でゲームに入ってよい。**打つ前・入る前に何をするか伝える。** 停止・再起動・ファイルの削除・ワールドの書き換え・プレイヤーに関わる操作（キック、ポイントの変更など）は、先にユーザーに確認する。

## SSH

- `ssh -o BatchMode=yes denken@denken-mc "<コマンド>"`（Tailscale 経由。この PC の鍵 `0qb36-pc` を登録済み）
- フォルダ: `/home/denken/workspace/paper1214`。ログは `logs/latest.log`、スクリプトは `plugins/Skript/scripts`
- Skript の版: `unzip -p /home/denken/workspace/paper1214/plugins/Skript-*.jar plugin.yml | grep ^version`（2026-10-26 は 2.13.1）
- 変数の中身は `plugins/Skript/variables.csv` だが、保存がまばらで古いことがある。今の状態はゲームの中（管理者ツール）で見る
- 表示しないもの: `~/.local/bin/update-skript-scripts.sh` の中身（RCON のパスワード）、git の取得用トークン、playit のアドレス

## コンソールに送る

```bash
ssh -o BatchMode=yes denken@denken-mc 'screen -S mcserver -p 0 -X stuff "<コマンド>\r"; sleep 1.5; tail -5 /home/denken/workspace/paper1214/logs/latest.log'
```

- **`-p 0` を必ず付ける。** ないと何も届かず、エラーも出ない（2026-10-25 に `save-on` が届かず、翌日まで自動保存が止まっていた）
- 送ったら、必ず `latest.log` で結果を確かめる
- `save-off` を送ったら、作業のあとに `save-on` を送って `Automatic saving is now enabled` を確かめる

## ClaudeBot でゲームに入る

```bash
S=/c/Users/0qb36/AppData/Local/Temp/claude/<セッションの scratchpad>; : > $S/live-cmd.txt; : > $S/live-log.txt
cd /f/Claude/skript-univfes2026-scripts/tests/bot && node live.js denken-mc 25565 ClaudeBot "$S/live-cmd.txt" "$S/live-log.txt"
```

- `run_in_background` で起動する。入ると自動で `/gamemode creative` になる（サバイバルのままだと夜に倒され続け、全員のチャットに死亡が流れる）
- 操作はコマンドのファイルに 1 行ずつ足す。記録のファイルにチャット・本・チェスト画面の中身が書かれる
  ```bash
  printf '%s\n' "!tool" >> $S/live-cmd.txt; sleep 2; printf '%s\n' "!book 35" >> $S/live-cmd.txt; sleep 3; tail -40 $S/live-log.txt
  ```
- コマンド: `!tool`（管理者ツールを開く）、`!book <スロット|yes|no>`、`!win <スロット>`、`!close`、`!pos`、`!inv`、`!block x y z`、`!click x y z`、`!quit`、それ以外はチャット（`/` でコマンド）
- ブロックを見るときは、先に `/tp ClaudeBot x y z` で近くへ行く（読み込まれていないチャンクは見えない）
- 管理者ツールの項目のスロット: 最初の画面は 10 モジュール、11 ワールドとロビー、12 ダンジョンの各階、28 プレイヤー、35 OP の一覧、49 戻る。各階の画面は 40 全階を設定、42 ライトの置き直し
- 確かめるだけのときは、設定を変える項目を押さない。押すときはユーザーに確認してから
- 管理者ツールをなくしたら `/ufadmin tool`
- 終わったら `!quit`。開発が全部終わったら、ユーザーに管理者ツールの「OP の一覧」で ClaudeBot の OP を外してもらう（`online-mode=false` なので、同じ名前で入れば誰でも OP になる）
