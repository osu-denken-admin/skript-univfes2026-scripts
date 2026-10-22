# ボットによるプレイテスト

mineflayer のボット 2 体（`UfAdmin` と `UfPlayer`）がテストサーバーに入り、実際にプレイして機能を確認します。
GUI のクリック、購入、ダンジョンの戦闘と報酬、死亡と回収、蘇生、カジノなどを自動で試し、結果を PASS / FAIL で表示します。

> **必ずローカルのテストサーバーで実行してください。**
> このテストはワールドを書き換え（ブロックの設置・`kill`・ゲームルールの変更）、ボットに OP を付けます。本番サーバーには絶対につながないでください。

## 2026-10-23 の結果

本番と同じ **Paper 1.21.4 + Skript 2.16.2** と、Paper 1.21.11 + Skript 2.16.2 の両方で **84 / 84 PASS**。統合版の操作は確認できない（ボットは Java 版）。

## 用意するもの

- Java 21、Node.js 18 以降
- 本番と同じ Paper 1.21.4 と Skript 2.16.2 を入れたテストサーバー（ボットはサーバーのバージョンに自動で合わせる）
- テストサーバーの `plugins/Skript/scripts` に、このリポジトリの `main.sk` と `uf_*.sk` を入れる

## テストサーバーの設定（`server.properties`）

```properties
server-ip=127.0.0.1
server-port=25599
online-mode=false
enforce-secure-profile=false
level-type=minecraft\:flat
```

`online-mode=false` はボットがアカウントなしで入るためです。`server-ip=127.0.0.1` で、このPCからしか接続できないようにします。

## 実行のしかた

テストはサーバーのコンソールにコマンドを送るため、サーバーの標準入力をファイル（`cmds.txt`）につないで起動します（Git Bash の例）。

```bash
cd テストサーバーのフォルダ
: > cmds.txt
tail -f -s 0.2 cmds.txt | java -Xmx2G -jar paper.jar nogui > server.out 2>&1 &
```

サーバーの起動後、モブが勝手に湧かないようにしてから（1.21.11 ではゲームルール名が変わっています）、テストを実行します。

```bash
cd テストサーバーのフォルダ
for c in "gamerule spawn_mobs false" "gamerule spawn_monsters false" "gamerule advance_time false" "time set day" "gamerule keep_inventory true" "gamerule immediate_respawn true" "difficulty normal"; do echo "$c" >> cmds.txt; done
```

```bash
cd tests/bot
npm install
node test.js "テストサーバーのフォルダ/cmds.txt"
```

一部だけ試すときは、テスト名をカンマ区切りで渡します。

```bash
node test.js "テストサーバーのフォルダ/cmds.txt" economy,casino
```

テスト名: `admintool` `economy` `dungeon` `death` `revive` `casino` `rpg` `tools` `guns` `admingui2` `security`

## 注意

- **毎回、まっさらな状態で実行してください。** ワールド（`world` など）と `plugins/Skript/variables.csv` を消してから起動します。
  - 2 回目以降は「初回クリア報酬」などが出ないため、`dungeon` などが失敗します。
  - 前回の残りのモブ（スライムなど）がいると、ボットが倒されて失敗します。
- `admintool` が最初にモジュールの有効化と 2 階の設定を行います。ほかのテストはこれが終わっている前提です。
- コンソールへのコマンドは少し遅れて届くことがあるため、テスト内で待ち時間を入れています。失敗したときは、まず `server.out` で順番を確認してください。
- 結果は画面と `results.json` に出ます。
