---
name: uf-localtest
description: このリポジトリの Skript をローカルのテストサーバー（本番と同じ Paper 1.21.4 + Skript 2.13.1）でボットを使って確かめる手順。.sk を変えたあと、main に入れる前、「テストして」と言われたときに使う。テストサーバーをまっさらにして test.js と lights.js を流し、結果を記録する。
---

# ローカルテスト

`.sk` を変えたら、main に入れる前に必ずこれを通す。本番にはつながない（テストはワールドを書き換え、ボットに OP を付ける）。

## テストサーバー

- この PC（Windows）: `F:\Claude\testserver-1214`（Git Bash では `/f/Claude/testserver-1214`）
  - `paper.jar`（paper-1.21.4-232、sha256 `5ee4f542f628a14c644410b08c94ea42e772ef4d29fe92973636b6813d4eaffc`）、`plugins/Skript-2.13.1.jar`
  - ほかの版の jar は `F:\Claude\testserver-jars`
- ない PC で作るときは `tests/bot/README.md` の手順。Paper は `https://fill.papermc.io/v3/projects/paper/versions/1.21.4/builds/232` の `downloads.server:default.url`、Skript は `https://github.com/SkriptLang/Skript/releases/download/2.13.1/Skript-2.13.1.jar`（ダウンロードはユーザーに確認してから）
- **本番の Skript の版に合わせる。** 本番で `unzip -p /home/denken/workspace/paper1214/plugins/Skript-*.jar plugin.yml | grep ^version` を見て、違っていたらテストサーバーも入れ替える

## 手順

1. 動いていたら止める: `echo stop >> /f/Claude/testserver-1214/cmds.txt`。`server.out` に `All dimensions are saved` が出るまで待ち、`echo x >> cmds.txt` で `tail` も終わらせる
2. **まっさらにする**（`test.js` は変数が空の前提。15号館の設定が残っているとダンジョンの項目が失敗する）:
   ```bash
   cd /f/Claude/testserver-1214 && rm -rf world world_nether world_the_end plugins/Skript/variables.csv* && rm -f plugins/Skript/scripts/main.sk plugins/Skript/scripts/uf_*.sk && cp /f/Claude/skript-univfes2026-scripts/main.sk /f/Claude/skript-univfes2026-scripts/uf_*.sk plugins/Skript/scripts/ && : > cmds.txt
   ```
3. 起動（Bash の `run_in_background`）:
   ```bash
   cd /f/Claude/testserver-1214 && tail -f -s 0.2 cmds.txt | java -Xmx2G -jar paper.jar nogui > server.out 2>&1
   ```
4. `server.out` に `Done (` が出るまで待つ。`All scripts loaded without errors.` と `Loaded 16 scripts` を確かめる。`Line <番号>:` のエラーが出たら直してからやり直す（警告は本番にも出ているもの: `uf_14_admintool.sk` の 937 行、`uf_12_admin.sk` の 35 行）
5. ゲームルール（Skript 2.13 / Paper 1.21.4 は古い名前）:
   ```bash
   for c in "gamerule doMobSpawning false" "gamerule doDaylightCycle false" "time set day" "gamerule keepInventory true" "gamerule doImmediateRespawn true" "difficulty normal"; do echo "$c" >> /f/Claude/testserver-1214/cmds.txt; done
   ```
6. テスト（`tests/bot` で。`node_modules` がなければ `npm install`）:
   ```bash
   cd /f/Claude/skript-univfes2026-scripts/tests/bot && node test.js "F:/Claude/testserver-1214/cmds.txt" 2>&1 | grep -E "FAIL|RESULT"
   node lights.js "F:/Claude/testserver-1214/cmds.txt" 2>&1 | grep -E "FAIL|RESULT"
   ```
   - `test.js` を先に流す（`lights.js` はダンジョンのワールドを登録する）
   - 一部だけ: `node test.js <cmds.txt> economy,ops`（テスト名は README）。一部だけ流したあとに全体を流すときは、もう一度まっさらにする
   - `drun.js`（2→9 階の通し）は 15号館のワールドがあるときだけ
7. 止める（手順 1）
8. 結果を `tests/bot/README.md` の「結果」と `CLAUDE.md` の「テスト」に日付つきで書く

## 失敗したとき

- まず `server.out` で、コンソールのコマンドの順番とエラーを見る
- 新しい機能を足したら、`test.js` か `lights.js` に確かめる項目も足す（ボットで本の項目を押すには `clickBook`、確認の本は `'yes'`）
- Skript 2.13 と 2.16 で違うこと: アクションバーは 2.13 がオーバーレイのチャット（`messagestr` の `game_info`）、2.16 が `action_bar` パケット
