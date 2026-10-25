# ボットによるプレイテスト

mineflayer のボット 2 体（`UfAdmin` と `UfPlayer`）がテストサーバーに入り、実際にプレイして機能を確認します。
GUI のクリック、購入、ダンジョンの戦闘と報酬、死亡と回収、蘇生、カジノなどを自動で試し、結果を PASS / FAIL で表示します。

> **必ずローカルのテストサーバーで実行してください。**
> このテストはワールドを書き換え（ブロックの設置・`kill`・ゲームルールの変更）、ボットに OP を付けます。本番サーバーには絶対につながないでください。

## 結果

- 2026-10-26（ランキングの掲示板と NPC を追加）: `test.js` **108 / 108 PASS**（`boards` `npc` を追加）、`lights.js` **29 / 29 PASS**（Skript 2.13.1）
- 2026-10-26（本番の Skript が 2.13.1 だとわかったので、テストサーバーも 2.13.1 にした）: `test.js` **95 / 95 PASS**（OP の付け外し `ops` を追加）、`lights.js` **29 / 29 PASS**
- 2026-10-26（ボスの剣を手に持たせ、画面下をスコアからポイントにした後）: `test.js` **89 / 89 PASS**（ボスの剣・アクションバーの 2 項目を追加）、`lights.js` **29 / 29 PASS**
- 2026-10-25（ライトの置き直しを追加した後）: Paper 1.21.4-232 + Skript 2.16.2 で `test.js` **87 / 87 PASS**、`lights.js` **29 / 29 PASS**（置き直しは約 1.3 秒）。`drun.js` は 15号館のワールドがない PC だったので未実行
- 2026-10-25（管理者ツールを本の画面にした後）: 本番と同じ **Paper 1.21.4 + Skript 2.16.2** で `test.js` **87 / 87 PASS**、`drun.js` **93 / 93 PASS**
  - `test.js` は変数が空（`plugins/Skript/variables.csv` なし）の状態から始める。15号館の設定が残っていると、ダンジョンの項目が平らな場所の前提と合わずに失敗する
- 2026-10-23: Paper 1.21.4 と 1.21.11（どちらも Skript 2.16.2）で 84 / 84 PASS

統合版の操作は確認できない（ボットは Java 版）。管理者ツールの本は、ボットが本の中身を読み取り、項目のコマンド（`/ufadmin ui …`）を送って押している。

## 用意するもの

- Java 21、Node.js 18 以降
- 本番と同じ Paper 1.21.4 と Skript 2.13.1 を入れたテストサーバー（ボットはサーバーのバージョンに自動で合わせる）
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

テスト名: `admintool` `economy` `dungeon` `death` `revive` `casino` `rpg` `tools` `guns` `admingui2` `boards` `npc` `ops` `security`

## 注意

- **毎回、まっさらな状態で実行してください。** ワールド（`world` など）と `plugins/Skript/variables.csv` を消してから起動します。
  - 2 回目以降は「初回クリア報酬」などが出ないため、`dungeon` などが失敗します。
  - 前回の残りのモブ（スライムなど）がいると、ボットが倒されて失敗します。
- `admintool` が最初にモジュールの有効化と 2 階の設定を行います。ほかのテストはこれが終わっている前提です。
- コンソールへのコマンドは少し遅れて届くことがあるため、テスト内で待ち時間を入れています。失敗したときは、まず `server.out` で順番を確認してください。
- 結果は画面と `results.json` に出ます。

## ライトの置き直しのテスト（`lights.js`）

管理者ツールの「15号館のライトを置き直す」を、平らなワールドで確かめます（15号館の建物はいりません）。範囲の中の余計なライトが消え、範囲の外のライトが残り、決まった場所に決まった明るさのライトが置かれることと、2 回目に押すと置いた 1817 個をちょうど消して置き直すことを確認します。

```bash
node lights.js "テストサーバーのフォルダ/cmds.txt"
```

## 15号館の通し挑戦テスト（`drun.js`）

15号館（`tools/dungeon` の内装と闘技場）を建てたテストサーバーで、2→9 階の通し挑戦を確認します。

```bash
node drun.js "テストサーバーのフォルダ/cmds.txt" "../../tools/dungeon/layout"
```

各階で、中ボスの壁 → 中ボス闘技場 → 戻る → 階段の壁 → ボス闘技場 → 戻る → 階段を上る、の流れと、9 階後に 1 階へ戻ること、中ボス前は階段の壁が開かないこと、反対側の階段・エレベーターで先へ進めないことを確認します（2026-10-23: 93 / 93 PASS）。

## 本番に入りっぱなしにするボット（`live.js`）

テストではなく、Claude が本番のゲームの中で操作するためのボットです（名前は `ClaudeBot`、OP あり）。**入る前にユーザーに伝えます。** ワールドを勝手に書き換える操作はしません。

```bash
node live.js denken-mc 25565 ClaudeBot cmd.txt log.txt
```

`cmd.txt` に 1 行ずつ足すと実行し、チャット・本・チェスト画面の中身を `log.txt` に書きます。コマンドの一覧は `live.js` の先頭にあります（`!tool` で管理者ツールを開き、`!book <スロット>` で項目を押す、など）。開発が終わったら、管理者ツールの「OP の一覧」で `ClaudeBot` の OP を外します。
