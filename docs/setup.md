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
| `uf_03_shop.sk` | `/buy`（`/shop` は QuickShop が使うため） | shop |
| `uf_04_party.sk` | `/party` | party |
| `uf_05_dungeon.sk` | `/dungeon`（受付）、2→9 階を階段で上る通し挑戦、中ボスの壁・階段の壁、闘技場、宝箱、報酬、全滅、`/ufd` | dungeon |
| `uf_15_layout.sk` | 15号館の内装・闘技場に合わせた各階の座標（自動生成。管理者ツールのボタンで登録） | dungeon |
| `uf_06_death.sk` | 死亡時のポイント、回収、蘇生 | death |
| `uf_07_rpg.sk` | レベル、経験値、`/skill` | rpg |
| `uf_08_tools.sk` | 3×3 ピッケル・シャベル、木こり斧、鉱石探知、グラップリングフック | tools |
| `uf_09_weapons.sk` | 銃、近接武器 | weapons |
| `uf_10_casino.sk` | `/casino` | casino |
| `uf_11_progress.sk` | `/quest`、実績、`/ranking`、`/status`、`/guide` | progress / guide |
| `uf_12_admin.sk` | `/ufadmin`（コマンド版）、確認画面、メンテナンス、イベント | （常時） |
| `uf_14_admintool.sk` | **管理者ツール（本）と管理メニュー。設定はすべてここから変えられる** | （常時） |
| `-uf_13_bike.sk` | バイク（**試験中。先頭の `-` により読み込まれない**） | weapons |
| `ops/backup.ps1` | バックアップ（世代管理つき） | — |
| `ops/start-server.ps1` | 起動と自動再起動（連続停止で中止＋通知） | — |

## 2. 本番に影響を出さないための仕組み

- **全モジュールは初期状態で「無効」**です。ファイルが反映されても、管理者が管理メニューの「モジュールの有効・無効」で有効にするまで、プレイヤーから見える動作は増えません。
  - 例外: プレイ時間の記録、プレイヤー名の記録、置いたブロックの記録（メモリのみ）、管理コマンド
- `main.sk` と `{score::*}` は変更していません。イベントスコアのリセット（管理メニュー → 大学祭イベント）だけが `{score::*}` を退避してから消去します（確認画面あり）。
- 変数はすべて `{uf::...}`（保存）と `{-uf::...}`（メモリのみ）にまとめています。既存の変数と衝突しません。
  - `{-...}` を保存しない動作は、Skript の `config.sk` が初期設定（`pattern: (?!-).*`）であることが前提です。

### 自動反映の仕組み（部長に確認済み・2026-10-22）

- サーバーの `plugins/Skript/scripts` がこのリポジトリの git clone になっている
- **10 分ごとに `git pull` → `sk reload all`** が自動で実行される
- GitHub 側には Webhook・Deploy key・Actions はない（公開リポジトリをサーバーが取りに来る方式）
- `git pull` はサーバーでチェックアウトしているブランチ（通常は `main`）にしか反映しないので、**別ブランチへの push は本番に入らない**
- `main` には保護設定がないため、`main` に入った変更は**最大 10 分で本番に入る**

### この方式で気をつけること

- **main に入れる前に、必ずテストサーバーで読み込みエラー 0 件を確認する。** 構文エラーのあるトリガーは読み込まれず、その機能だけが止まる。
- 元に戻すときは `git revert` で `main` に戻すコミットを入れる（次の pull で反映される）。プレイヤーデータ（`variables.csv`）は戻らない。
- `sk reload all` で、待ち時間の途中にある処理（ダンジョンクリア後の 10 秒待ち、反応速度ゲーム、鉱石探知）は中断される。
  - ダンジョン: クリア後 15 秒たっても終わっていなければ、定期チェックが必ず終了させる（対策済み）
  - 反応速度ゲーム: 途中で reload されると、その回の賭け金は戻らない（既知の制限）
  - 鉱石探知: 効果がそこで切れる（既知の制限）
- メモリ変数 `{-uf::...}`（パーティー・挑戦中のセッション）は reload では消えない。サーバーの再起動で消える。
- サーバー管理者への提案（任意）
  - `git pull` で変更がなかったときは reload しない（毎回の reload によるラグを避ける）
  - `sk reload all` ではなく `sk reload scripts` にする（`all` は設定とエイリアスも読み直すため重い。テスト環境では `sk reload all` 1 回でサーバーが約 1.3 秒止まった）
  - `main` にブランチ保護を設定し、プルリクエスト経由でのみ変更できるようにする

## 3. 前提とする環境（要確認）

本番: **Skript 2.16.2**（部長に確認済み）。プラグイン: PlugManX, Chunky, CrackShot, DiscordSRV, Elevator, FastAsyncWorldEdit, floodgate, Geyser-Spigot, GeyserExtras, GeyserSkinManager, ImageFrame, Jecon, LuckPerms, LunaChat, QuickShop-Hikari, Sit, SkinsRestorer, SkQuery, Skript, Vault, ViaBackwards, ViaRewind, ViaVersion, WorldEdit, worldedit-selection-viewer, WorldGuard

- **Paper 1.21.11 ＋ Java 21 のローカルテストサーバーで、Skript 2.16.2 と 2.17.1 の両方で読み込みエラー 0 件を確認済み**です（アドオン不要）。
  - コンソールから実行できる範囲の動作テスト（アイテム識別、名前だけの偽装の拒否、区域判定、初期設定、売却価格の名前、ランキング、ダンジョンの敵出現・段階進行・後片付け、宝箱の配置と撤去、保護区域、管理メニューの設定項目）72 項目がすべて通りました。
  - プレイヤーが必要な操作（GUI のクリック、購入、戦闘、死亡・蘇生、統合版）は**未確認**です。
- **SkQuery について**: GitHub 公式の最新版 SkQuery 4.3.2 は Skript 2.16.2 では起動に失敗し（`NoSuchMethodError`）、巻き添えで Skript のスクリプト読み込みも壊れました。本番で動いている SkQuery の版（`/version SkQuery`）を確認してください。このスクリプトは SkQuery を使いません。
- **コマンド名の衝突**: QuickShop-Hikari が `/shop` `/qs` `/chestshop` `/cshop` を使うため、このスクリプトのショップは **`/buy`** にしました。Jecon は `/jecon` `/money` なので衝突しません。
- 統合版は Geyser + Floodgate（導入済み）で接続できます。GUI はチェスト型なので統合版でも表示されます（操作感は未確認）。
- **Jecon（Vault 経済）との関係**: このスクリプトのポイントは Jecon のお金とは**別の残高**です。統一するかどうかは未決定です（QuickShop の取引でポイントを使いたい場合は統一が必要）。
- CrackShot（銃プラグイン）が導入済みです。このスクリプトの銃（雪玉方式）と併用するか、CrackShot に寄せるかは未決定です。
- WorldGuard が導入済みです。特殊道具の保護は、今はこのスクリプト独自の保護区域だけを見ています。

## 4. 有効化の手順（テスト環境で）

### 管理者ツール（本）

- 権限 `univfes.admin` を持つ人（OP は自動で持つ）が初めて参加したとき、**管理者ツール（本）**が 1 冊配られます。
  - LuckPerms で付ける例: `/lp group admin permission set univfes.admin true`
  - なくしたら `/ufadmin tool` で再発行
- **右クリック / 左クリック / 捨てる（Q）**で管理メニューが開きます。統合版はタップ、または捨てる操作で開きます。
- 管理者以外は開けず、拾うこともできません。権限は開くときとボタンを押すたびに確認します。
- 数値は **＋／－ボタンで調整 → 「決定」**。チャット入力は使いません。範囲外の値にはなりません。
- 消去・強制終了・イベントのリセットなどは確認画面が出ます。操作はすべて「操作履歴」に残ります。
- コマンド（`/ufadmin` `/ufd`）も残してあります。`/ufadmin` だけを打つと同じ管理メニューが開きます。

### 手順（すべて管理メニューから）

1. コンソールで、反映後に読み込みエラーが出ていないことを確認する
2. **ワールドとロビー**: 常設サバイバルのワールドで「常設サバイバル」、15号館のワールドで「15号館（ダンジョン）」を押す。15号館 1 階で「ロビー」を押す
3. **ダンジョンの各階**: 15号館の内装と闘技場を貼り付けたあと（手順は `tools/dungeon/README.md`）、「ダンジョンの各階」→「15号館の内装に合わせて全階を設定」を押す
   - 手で設定する場合は、階を選んで、その場所に立ってボタンを押す（開始・復帰地点、中ボス・ボス闘技場の入口と出現地点、敵の出現地点、宝箱の候補地点）。中ボスの壁・階段の壁の位置は「15号館の内装に合わせて全階を設定」でだけ登録される
4. **受付・ショップ・カジノの区域**（任意。未設定ならどこでも利用可）: 角 1・角 2 に立ってボタンを押す。受付は 1 階のダンジョン受付
5. **保護区域**（特殊道具で壊させない範囲）: 「新しい保護区域を作る」→ 反対の角へ移動して「角2」
6. **モジュールの有効・無効**: 1 つずつ有効にしてテストする
   - おすすめの順: 売却 → ショップ → パーティー → ダンジョン → 死亡・回収・蘇生 → クエスト・実績 → 初参加の案内 → レベル・スキル → 特殊道具 → 特殊武器 → カジノ
7. 価格・確率・報酬などは「ショップ」「カジノ」「売却価格」「各種設定」から変える
8. ダンジョンのワールドは、ゲームルールなどを管理者が設定する
   - 自然スポーンを止める（`doMobSpawning false`）
   - 建物を壊されないようにする（WorldGuard など）
   - 死亡時の持ち物の扱い（`keepInventory`）を決める

## 5. 主なコマンド

プレイヤー向け: `/guide` `/points` `/sell [all|list]` `/buy` `/dungeon [leave]` `/party invite|accept|leave` `/skill` `/upgrade` `/quest` `/achievements` `/ranking [earned|level|dkills|clears|event]` `/status` `/casino`

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
