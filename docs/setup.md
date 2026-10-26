# 導入・運用ガイド（univfes Skript 一式）

設計書 第2版をもとに作った機能一式です。ローカルのテストサーバー（本番と同じ Paper 1.21.4 + Skript 2.13.1）で、ボットのプレイテスト（`tests/bot`）に通してから本番に入れています。テストの手順と結果は [tests/bot/README.md](../tests/bot/README.md)。

## 1. ファイル構成

| ファイル | 内容 | モジュール名 |
|---|---|---|
| `main.sk` | 画面下（アクションバー）にポイント。ダンジョンで中ボス・ボスと戦っている間はその体力のバー | （常時） |
| `uf_00_core.sk` | 設定の初期値、ポイント・チップ、ログ、アイテム識別、GUI 管理、区域判定 | （常時） |
| `uf_01_items.sk` | 特殊アイテムの定義、回復キット、アクセサリー、`/upgrade` | weapons |
| `uf_02_economy.sk` | `/points`、`/sell` | economy |
| `uf_03_shop.sk` | `/buy`（`/shop` は QuickShop が使うため） | shop |
| `uf_04_party.sk` | `/party` | party |
| `uf_05_dungeon.sk` | `/dungeon`（受付）、2→9 階を階段で上る通し挑戦、中ボスの壁・階段の壁、闘技場、宝箱、報酬、全滅、`/ufd` | dungeon |
| `uf_06_death.sk` | 死亡時のポイント、回収、蘇生 | death |
| `uf_07_rpg.sk` | レベル、経験値、`/skill` | rpg |
| `uf_08_tools.sk` | 3×3 ピッケル・シャベル、木こり斧、鉱石探知、グラップリングフック | tools |
| `uf_09_weapons.sk` | 銃、近接武器 | weapons |
| `uf_10_casino.sk` | `/casino`（スロット・ルーレット・反応速度ゲーム、交換） | casino |
| `uf_11_progress.sk` | `/quest`、実績、`/ranking`、`/status`、`/guide` | progress / guide |
| `uf_12_admin.sk` | `/ufadmin`（コマンド版）、確認画面、メンテナンス | （常時） |
| `uf_13_bike.sk` | バイク（見えない馬。強化キット、走ると草花・葉をなぎ倒す） | tools |
| `uf_14_admintool.sk` | **管理者ツール（本）と管理メニュー。設定はすべてここから変えられる** | （常時） |
| `uf_15_layout.sk` | 15号館の内装・闘技場に合わせた各階の座標とライト（自動生成。管理者ツールのボタンで登録） | dungeon |
| `uf_16_board.sk` | ランキングの掲示板（壁に貼りつける浮かぶ文字） | （常時） |
| `uf_17_npc.sk` | 受付・ショップ・カジノの NPC（村人） | 各モジュール |
| `uf_18_mobs.sk` | ダンジョンの敵（階ごとの顔ぶれ・技・怒り・体力のバー） | dungeon |
| `uf_19_gear.sk` | ダンジョン産の武具（武器 8 本・防具 3 セット） | dungeon |
| `uf_20_items2.sk` | ショップの気軽なアイテム（ドリンク・ボム・帰還の巻物など） | shop |
| `uf_21_casino2.sk` | カジノの追加のゲーム（サイコロ・ハイ＆ロー・ガチャ） | casino |
| `tools/dungeon/` | 15号館の内装・闘技場の生成と `.litematic` 書き出し | — |
| `tools/server/` | 本番の起動の仕組み（`run.sh`、systemd のサービス）とバックアップ | — |
| `tests/bot/` | ボットによるプレイテストと、本番に入りっぱなしにするボット（`live.js`） | — |
| `.claude/skills/` | Claude Code 用の手順（ローカルテスト、本番への反映、本番の操作） | — |
| `ops/*.ps1` | Windows 向けのバックアップ・起動のスクリプト。**本番は Linux なので使っていない**（代わりは `tools/server/`） | — |

## 2. 本番に影響を出さないための仕組み

- **全モジュールは初期状態で「無効」**です。管理者が管理メニューの「モジュールの有効・無効」で有効にするまで、プレイヤーから見える動作は増えません。
  - 例外: プレイ時間・プレイヤー名・置いたブロックの記録、管理コマンド、画面下のポイントの表示、掲示板
- 変数はすべて `{uf::...}`（保存）と `{-uf::...}`（メモリのみ）にまとめています。
  - `{-...}` を保存しない動作は、Skript の `config.sk` が初期設定（`pattern: (?!-).*`）であることが前提です。
- 前からあった `main.sk` のモンスター討伐のスコア（`{score::*}`）は、2026-10-26 に数えるのをやめました（データは残っています）。

### 自動反映の仕組み

- サーバーの `plugins/Skript/scripts` がこのリポジトリの git clone になっている
- ユーザーの systemd タイマー `skript-git-pull.timer` が **10 分ごと**に `~/.local/bin/update-skript-scripts.sh` を動かす。`git pull --ff-only` して、HEAD が変わったときだけ RCON で `sk reload scripts`
- Linger を有効にしてあるので、マシンを再起動してもログインせずにタイマーが動く
- `git pull` はサーバーでチェックアウトしているブランチ（`main`）にしか反映しないので、**別ブランチへの push は本番に入らない**。`main` に入れたものは**最大 10 分で本番に入る**

### この方式で気をつけること

- **main に入れる前に、必ずテストサーバーで読み込みエラー 0 件とボットのテストを確認する。** 構文エラーのあるトリガーは読み込まれず、その機能だけが止まる。
- 元に戻すときは `git revert` で `main` に戻すコミットを入れる（次の pull で反映される）。プレイヤーデータ（`variables.csv`）は戻らない。
- 本番の `scripts` フォルダで直接ファイルを変えない（次の `git pull --ff-only` が止まる）
- `sk reload scripts` で、待ち時間の途中にある処理（ダンジョンクリア後の待ち、反応速度ゲーム、鉱石探知）は中断される。
  - ダンジョン: 定期チェックが必ず先へ進める（対策済み）
  - 反応速度ゲーム: 途中で reload されると、その回の賭け金は戻らない（既知の制限）
- メモリ変数 `{-uf::...}`（パーティー・挑戦中のセッション）は reload では消えない。サーバーの再起動で消える。

## 3. 本番の環境

- Linux のマシン `denken-mc`（ユーザー `denken`）。フォルダは `/home/denken/workspace/paper1214`
- **Paper 1.21.4（`paper-1.21.4-232.jar`）、Skript 2.13.1**、Java 21
- プラグイン: PlugManX, Chunky, CrackShot, DiscordSRV, Elevator, FastAsyncWorldEdit, floodgate, Geyser-Spigot, GeyserExtras, GeyserSkinManager, ImageFrame, Jecon, LuckPerms, LunaChat, QuickShop-Hikari, Sit, SkinsRestorer, SkQuery 4.3.2, Skript, Vault, ViaBackwards, ViaRewind, ViaVersion, worldedit-selection-viewer, WorldGuard
  - WorldEdit は FastAsyncWorldEdit が代わりをしている（名前がかぶって読み込まれなかった jar は `plugins/_unused/`）
  - SkQuery 4.3.2 は Skript 2.13.1 では一部（152 個中 102 個）だけ読み込まれる。このスクリプトは SkQuery を使わない
- サーバーの回線は、マイクラ関係の接続先（Mojang・Modrinth・`minecraft-services.net`）だけを切る。Java の外向きの通信を Cloudflare WARP（プロキシのモード）に通して、統合版の入口の Geyser を動かしている（`tools/server/README.md`）
- **コマンド名の衝突**: QuickShop-Hikari が `/shop` `/qs` を使うため、このスクリプトのショップは **`/buy`**。Jecon は `/jecon` `/money` なので衝突しない
- 統合版は Geyser + Floodgate。プレイヤー向けの GUI はチェスト型なので統合版でも表示される（実機での操作感は未確認）。管理者ツールは Java 版が本の画面、統合版がチェスト画面
- 未決定: Jecon とポイントを統一するか（QuickShop の取引でポイントを使うなら統一が必要）、CrackShot と独自の銃のどちらにするか、WorldGuard との連携
- `online-mode=false` なので、名前を名乗るだけで誰にでもなれる（OP の人にも）。対策（AuthMe など）は未決定

## 4. 有効化の手順（管理者ツールから）

### 管理者ツール（本）

- 権限 `univfes.admin` を持つ人（OP は自動で持つ）が初めて参加したとき、**管理者ツール（本）**が 1 冊配られます。
  - LuckPerms で付ける例: `/lp group admin permission set univfes.admin true`
  - なくしたら `/ufadmin tool` で再発行
- **右クリック / 左クリック / 捨てる（Q）**で管理メニューが開きます。
  - Java 版は**本の画面**で開きます。`▶` の付いた項目をクリックすると操作され、本が開き直されて結果が見えます。項目にマウスを合わせると説明が出ます
  - 本の項目は、裏で `/ufadmin ui <画面番号> <番号>` を実行しています（手で打つものではありません）。前に開いた古い本を押した場合は、何もせずに今の画面を開き直します
  - ハブ（最初の画面）の「表示: 本 → チェストにする」で、チェスト画面に切り替えられます（管理者ごとの設定）
  - 統合版は本のクリックが使えないため、常にチェスト画面で開きます（タップ、または捨てる操作）
- 管理者以外は開けず、拾うこともできません。権限は開くときとボタンを押すたびに確認します。
- 数値は **＋／－ボタンで調整 → 「決定」**。チャット入力は使いません。範囲外の値にはなりません。
- 消去・強制終了などは確認画面が出ます。操作はすべて「操作履歴」に残ります。
- 「OP の一覧」「プレイヤー → OP を付ける／外す」は OP の人にだけ出ます。

### 手順

1. 反映後に読み込みエラーが出ていないことを確認する
2. **ワールドとロビー**: 常設サバイバルのワールドで「常設サバイバル」、15号館のワールドで「15号館（ダンジョン）」を押す。15号館 1 階で「ロビー」を押す
3. **ダンジョンの各階**: 15号館の内装と闘技場を貼り付けたあと（`tools/dungeon/README.md`）、「15号館の内装に合わせて全階を設定」と「15号館のライトを置き直す」を押す
4. **NPC**: 受付・ショップ・カジノの村人を、置きたい場所に立って、来た人のほうを向いて置く
5. **ランキングの掲示板**: 掲示板にしたい壁の下の端のブロックを見ながら、種類を押す
6. **受付・ショップ・カジノの区域**（任意。未設定ならどこでも利用可）: 角 1・角 2 に立ってボタンを押す。NPC から開いた人は 3 分間、区域の外でも使える
7. **保護区域**（特殊道具・バイクで壊させない範囲）: 「新しい保護区域を作る」→ 反対の角へ移動して「角2」
8. **モジュールの有効・無効**
   - おすすめの順: 売却 → ショップ → パーティー → ダンジョン → 死亡・回収・蘇生 → クエスト・実績 → 初参加の案内 → レベル・スキル → 特殊道具 → 特殊武器 → カジノ
9. 価格・確率・報酬などは「ショップ」「カジノ」「売却価格」「各種設定」から変える。バイク（キー・強化キット）は初めは販売停止なので、売るならショップで販売中にする
10. ダンジョンのワールドは、ゲームルールなどを管理者が設定する（自然スポーンを止める、建物を壊されないようにする、死亡時の持ち物の扱いを決める）

## 5. 主なコマンド

プレイヤー向け: `/guide` `/points` `/sell [all|list]` `/buy` `/dungeon [leave]` `/party invite|accept|leave` `/skill` `/upgrade` `/quest` `/achievements` `/ranking [earned|level|dkills|clears|chipwon|sold|bought]` `/status` `/casino`

管理者向け（権限 `univfes.admin`）は `uf_12_admin.sk` の先頭と `/ufd` の一覧を参照してください。設定値は `/ufadmin cfg <キー> [値]` で確認・変更できます（例: `/ufadmin cfg reward::boss 300`）。

## 6. ログ

`plugins/Skript/logs/` に次のファイルが出力されます。

- `univfes_economy.log` ポイントの増減（理由・残高つき）
- `univfes_casino.log` チップの増減とゲーム結果
- `univfes_shop.log` 購入
- `univfes_dungeon.log` 挑戦の開始・終了・報酬・宝箱
- `univfes_admin.log` 管理者の操作（直近 50 件は `/ufadmin log` でも確認可）
- `univfes_rpg.log` / `univfes_death.log` / `univfes_progress.log` / `univfes_item.log`

## 7. 起動とバックアップ

- サーバーと playit は systemd のユーザーのサービス（`mc-server`・`playit`）で、マシンを起動すると自動で動く。止めるのは `systemctl --user stop mc-server`（コンソールの `stop` だと 15 秒後にまた起動する）。詳しくは [tools/server/README.md](../tools/server/README.md)
- 毎日 5:00 にバックアップ（`tools/server/backup.sh` と `mc-backup.timer`）。ワールド・プラグインのデータと設定・サーバーの設定ファイルを `/home/denken/workspace/backups/world-<日時>.tar.gz` に固め、7 個残す。手で取るときは `systemctl --user start mc-backup`
- 復元テスト（2026-10-26）: バックアップを別のフォルダに展開し、`server.properties` を 127.0.0.1・別のポートにして、プラグインなしで起動できることを確かめた
- Discord への通知を使うときは、環境変数 `UF_DISCORD_WEBHOOK` に URL を設定する。URL はリポジトリに書かない
