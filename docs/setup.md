# 導入・運用ガイド（univfes Skript 一式）

設計書 第2版をもとに、全機能を Skript で一通り実装したものです。
**すべて未検証**です。本番に入れる前に、必ずテスト環境で `docs/test-plan.md` の手順を実施してください。

## 1. ファイル構成

| ファイル | 内容 | モジュール名 |
|---|---|---|
| `main.sk` | 既存のイベントスコア（**変更なし**） | — |
| `uf_00_core.sk` | 設定の初期値、ポイント・チップ、ログ、アイテム識別、GUI 管理、区域判定 | （常時） |
| `uf_01_items.sk` | 特殊アイテムの定義、回復キット、アクセサリー、`/upgrade` | weapons |
| `uf_02_economy.sk` | `/points`、`/sell` | economy |
| `uf_03_shop.sk` | `/shop`、ショップ管理 GUI | shop |
| `uf_04_party.sk` | `/party` | party |
| `uf_05_dungeon.sk` | `/dungeon`、フロアマップ、敵・ボス・宝箱・報酬、`/ufd` | dungeon |
| `uf_06_death.sk` | 死亡時のポイント、回収、蘇生 | death |
| `uf_07_rpg.sk` | レベル、経験値、`/skill` | rpg |
| `uf_08_tools.sk` | 3×3 ピッケル・シャベル、木こり斧、鉱石探知、グラップリングフック | tools |
| `uf_09_weapons.sk` | 銃、近接武器 | weapons |
| `uf_10_casino.sk` | `/casino`、カジノ管理 GUI | casino |
| `uf_11_progress.sk` | `/quest`、実績、`/ranking`、`/status`、`/guide` | progress / guide |
| `uf_12_admin.sk` | `/ufadmin`、管理 GUI、メンテナンス、イベント | （常時） |
| `-uf_13_bike.sk` | バイク（**試験中。先頭の `-` により読み込まれない**） | weapons |
| `ops/backup.ps1` | バックアップ（世代管理つき） | — |
| `ops/start-server.ps1` | 起動と自動再起動（連続停止で中止＋通知） | — |

## 2. 本番に影響を出さないための仕組み

- **全モジュールは初期状態で「無効」**です。ファイルが反映されても、管理者が `/ufadmin module <名前> on` を実行するまで、プレイヤーから見える動作は増えません。
  - 例外: プレイ時間の記録、プレイヤー名の記録、置いたブロックの記録（メモリのみ）、管理コマンド
- `main.sk` と `{score::*}` は変更していません。`/ufadmin event reset` だけが `{score::*}` を退避してから消去します（確認画面あり）。
- 変数はすべて `{uf::...}`（保存）と `{-uf::...}`（メモリのみ）にまとめています。既存の変数と衝突しません。
  - `{-...}` を保存しない動作は、Skript の `config.sk` が初期設定（`pattern: (?!-).*`）であることが前提です。
- 自動反映の仕組みがまだ分かっていないため、**このブランチを main にマージする前に**、反映される範囲（`main.sk` だけか、全 `.sk` か）を確認してください。

## 3. 前提とする環境（要確認）

- **Paper 1.21.11（build 132）＋ Skript 2.17.1 ＋ Java 21 のローカルテストサーバーで、全ファイルが読み込みエラー 0 件で読み込めることを確認済み**です（アドオン不要）。
  - 同時に、コンソールから実行できる範囲の動作テスト（アイテム識別、名前だけの偽装の拒否、区域判定、初期設定、売却価格の名前、ランキング、ダンジョンの敵出現・段階進行・後片付け、宝箱の配置と撤去、保護区域）72 項目がすべて通りました。
  - プレイヤーが必要な操作（GUI、購入、戦闘、死亡・蘇生、統合版）は**未確認**です。
  - 本番の Skript が古い場合（2.16 以前など）は、構文の違いでエラーが出る可能性があります。
- 統合版は Geyser + Floodgate が必要です（このスクリプトでは導入しません）。
- コマンド名 `/shop` `/sell` `/party` `/points` などが、他のプラグイン（EssentialsX など）と重なる可能性があります。重なる場合は、どちらを優先するかを決めてください。

## 4. 有効化の手順（テスト環境で）

1. `/sk reload all`（または自動反映）でエラーが出ないことをコンソールで確認する
2. ワールドを登録する
   - `/ufadmin world survival`（常設サバイバルで実行）
   - `/ufadmin world dungeon`（15号館のワールドで実行）
3. 15号館 1 階でロビーを登録: `/ufd lobby`
4. 各階を設定する（2〜9 階）
   - `/ufd start <階>` 開始地点、`/ufd cp <階>` 死亡時の復帰地点（未設定なら開始地点）
   - `/ufd addspawn <階>` を敵を出したい場所で数回
   - `/ufd mid <階>` `/ufd boss <階>` 中ボス・ボスの出現地点（未設定なら出現地点から抽選）
   - `/ufd addchest <階>` を宝箱の候補地点（3〜5 か所）で実行
   - `/ufd info <階>` で確認
5. ショップ・カジノの区域（任意。未設定ならどこでも利用可）
   - `/ufadmin area shop pos1` / `pos2`、`/ufadmin area casino pos1` / `pos2`
6. 保護区域（特殊道具から守る範囲）: `/ufadmin prot spawn pos1` / `pos2`
7. モジュールを 1 つずつ有効化してテストする
   - おすすめの順: `economy` → `shop` → `party` → `dungeon` → `death` → `progress` → `guide` → `rpg` → `tools` → `weapons` → `casino`
8. ダンジョンのワールドは、ゲームルールなどを管理者が設定する
   - 自然スポーンを止める（`doMobSpawning false`）
   - 建物を壊されないようにする（WorldGuard など）
   - 死亡時の持ち物の扱い（`keepInventory`）を決める

## 5. 主なコマンド

プレイヤー向け: `/guide` `/points` `/sell [all|list]` `/shop` `/dungeon [leave]` `/party invite|accept|leave` `/skill` `/upgrade` `/quest` `/achievements` `/ranking [earned|level|dkills|clears|event]` `/status` `/casino`

管理者向け（権限 `univfes.admin`）は `uf_12_admin.sk` の先頭と `/ufd` の一覧を参照してください。設定値は `/ufadmin cfg <キー> [値]` で確認・変更できます（例: `/ufadmin cfg reward::boss 300`）。

## 6. ログ

`plugins/Skript/logs/` に次のファイルが出力されます。

- `univfes_economy.log` ポイントの増減（理由・残高つき）
- `univfes_casino.log` チップの増減とゲーム結果
- `univfes_shop.log` 購入
- `univfes_dungeon.log` 挑戦の開始・終了・報酬・宝箱
- `univfes_admin.log` 管理者の操作（直近 50 件は `/ufadmin log` でも確認可）
- `univfes_rpg.log` / `univfes_death.log` / `univfes_progress.log` / `univfes_item.log`

## 7. バックアップと自動再起動

```powershell
powershell -ExecutionPolicy Bypass -File ops\backup.ps1 -ServerDir "D:\mcserver" -BackupDir "E:\mc-backup" -Keep 14
powershell -ExecutionPolicy Bypass -File ops\start-server.ps1 -ServerDir "D:\mcserver" -Jar "paper.jar" -BackupDir "E:\mc-backup"
```

- サーバー PC の OS が Windows である前提で書いています。Linux の場合は書き直しが必要です。
- Discord への通知は、環境変数 `UF_DISCORD_WEBHOOK` に URL を設定したときだけ送ります。URL はリポジトリに書かないでください。
- 定期実行は Windows のタスク スケジューラで `backup.ps1` を登録してください。
