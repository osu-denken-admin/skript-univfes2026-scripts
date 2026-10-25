# CLAUDE.md

大阪産業大学 電子計算研究部の Minecraft サーバー（大学祭展示＋常設）用の Skript 一式。
`main.sk` が元からあるスクリプト、`uf_*.sk` が設計書 第2版で追加した機能。

## 作業のルール

- **返答は必ず日本語で書く**（長い作業のあとの最後の報告も）。コードのコメントも日本語に合わせる
- **main に入れたものは 10 分以内に本番へ届く**（下の「本番への反映」）。main へのマージ・push はユーザーが頼んだときだけ。普段は feature ブランチで作業する
- feature ブランチの push は確認なしでよい
- **このリポジトリは公開（public）**。秘密情報や接続先アドレスを書かない・コミットしない: GitHub トークン、RCON パスワード、playit のアドレス、Discord の Webhook URL（使うときは環境変数 `UF_DISCORD_WEBHOOK`）。ログを貼ってもらうときは伏せてもらう
- ボットのテストは**ローカルのテストサーバーだけ**。本番にはつながない
- 本番サーバーの操作はユーザーが SSH で自分で行う。Claude はコマンドを 1 つずつ `bash` のコードブロックで渡し、結果を貼ってもらう。`<パス>` のようなプレースホルダは使わず、実際の値を書く（そのまま打たれてしまう）
- ゲーム内の操作は、管理者ツール（本）でできるようにする。コマンドだけの機能にしない（使えない人が出る）

## 本番環境

- サーバー: Linux の `denken-mc`（ユーザー `denken`）。Paper 1.21.4（`paper-1.21.4-232.jar`）、Skript 2.16.2、Java 21
- フォルダ: `/home/denken/workspace/paper1214`。スクリプトは `plugins/Skript/scripts`（このリポジトリの clone）
- `online-mode=false`。起動時の Mojang・Modrinth などへの `Connection reset` は前からあるもので問題ない
- プラグイン: PlugManX, Chunky, CrackShot, DiscordSRV, Elevator, FastAsyncWorldEdit, floodgate, Geyser-Spigot, GeyserExtras, GeyserSkinManager, ImageFrame, Jecon, LuckPerms, LunaChat, QuickShop-Hikari（`/shop` `/qs` を使う。こちらのショップは `/buy`）, Sit, SkinsRestorer, SkQuery（版は未確認。4.3.2 は 2.16.2 で壊れる）, Vault, ViaVersion 系, WorldEdit, worldedit-selection-viewer, WorldGuard

### 本番への反映

- ユーザーの systemd タイマー `skript-git-pull.timer` が 10 分ごとに `~/.local/bin/update-skript-scripts.sh` を実行する
- 中身: `git pull --ff-only` して、HEAD が変わったときだけ RCON（mcrcon）で `sk reload scripts`
- 反映の確認: `cd /home/denken/workspace/paper1214/plugins/Skript/scripts && git log -1 --oneline`

### 起動（再起動後は自動で起動しないので手で）

```bash
screen -S mcserver -d -m bash -c "cd /home/denken/workspace/paper1214 && sh run.sh"
```
```bash
screen -S playit -d -m playit
```

- 画面を見る: `screen -r mcserver` / `screen -r playit`。抜けるのは `Ctrl+A` → `D`（`Ctrl+C` はサーバーが止まる）
- playit のトンネル: Java 版 → 25565、統合版 → 19132（接続先のアドレスはユーザーに聞く。**このリポジトリは公開なので、アドレスや秘密情報をここに書かない**）
- **`warp-cli connect` は打たせない**（Cloudflare WARP は入っているが未登録。つなごうとすると playit 経由で入れなくなった。直すときは `warp-cli disconnect` して playit を起動し直す）
- 2026-10-25 に SSD の省電力が原因でフリーズ → 省電力を切って再起動した。このときスクリプトが読めず `main.sk` しか読まれていなかった

## ファイル

| ファイル | 内容 |
|---|---|
| `uf_00_core.sk` | 初期設定、ポイント・チップ、ログ、アイテム識別（lore の `&8uf:<id>`）、GUI 管理、区域判定 |
| `uf_01`〜`uf_11` | アイテム、売却、ショップ（`/buy`）、パーティー、ダンジョン、死亡・回収・蘇生、RPG、特殊道具、武器、カジノ、クエスト・実績 |
| `uf_12_admin.sk` | `/ufadmin` コマンドと確認画面 |
| `uf_14_admintool.sk` | 管理者ツール（本）。Java 版は本の画面（項目は `/ufadmin ui <画面番号> <スロット>`）、統合版と「チェスト表示」を選んだ人はチェスト画面 |
| `uf_15_layout.sk` | 15号館の各階の座標と壁の位置（`tools/dungeon/preset.js` で自動生成。手で直さない） |
| `-uf_13_bike.sk` | 試作のバイク（`-` で無効） |
| `tools/dungeon/` | 15号館の内装・闘技場の生成と `.litematic` 書き出し。`layout/` に完成品。詳しくは同じフォルダの README |
| `tests/bot/` | mineflayer のボットによるプレイテスト（`test.js`、`drun.js`） |
| `docs/` | `setup.md`（導入・運用）、`decisions.md`（仮の仕様）、`test-plan.md` |

- モジュールは初期状態ですべて無効（`{uf::mod::<名前>}`）。管理者ツールの「モジュール」でオンにする
- 変数: 保存するものは `{uf::...}`、一時的なものは `{-uf::...}`

## ダンジョン（15号館）の仕組み

1 階の受付で開始階を選ぶ → 偶数階は西の階段から東へ、奇数階は東から西へ進む → 階の途中の中ボスの壁（泣く黒曜石）をクリックすると上空の中ボス闘技場へ → 勝つと元の場所に戻り壁が消える → 出口の上り階段をふさぐ壁（強化深層岩）をクリックするとボス闘技場へ → 勝つと階段が現れて次の階へ。9 階のボスで制覇。全滅・時間切れで 1 階へ戻る。反対側の上り階段は白コンクリートでずっとふさぐ。詳しくは `tools/dungeon/README.md`。

## Skript 2.16.2 の注意点（実際にはまったもの）

- 文字列の中の `%関数("文字")%` のように、`%…%` の中で `"` を使うと読めない。先に変数に入れてからつなぐ
- `loop-value-2` などの番号は、ネストした loop の順番で数える
- `potion` はあいまい（`water bottle` を使う）。効果の強さを変数で `apply speed {_t}` はできない
- `permission message` は非推奨
- ブロックの状態は `"%block data of block at L%"` で保存し、`({文字} parsed as block data)` で戻せる
- 本: `open book {_b} to player` で開ける。`<cmd:/…>` `<tooltip:…>` は **`formatted` にした文字だけ**クリック・説明になる。説明（tooltip）の中に色記号（`&7`）があると説明として読まれず、半角の `:` から後ろは消える（`uf_bklink` で色を外し、`:` `<` `>` を全角にしている）
- `book title of` は非推奨（`title of`）
- Minecraft 1.21.11 ではゲームルール名が変わる（本番の 1.21.4 は古い名前）

## テスト

ローカルに本番と同じ Paper 1.21.4 + Skript 2.16.2 のテストサーバーを作り、ボットで確かめてから main に入れる。手順は `tests/bot/README.md`。

- `server.properties`: `server-ip=127.0.0.1`、`server-port=25599`、`online-mode=false`、平らなワールド
- サーバーの標準入力を `cmds.txt` につなぐ: `tail -f -s 0.2 cmds.txt | java -Xmx2G -jar paper.jar nogui > server.out 2>&1 &`
- `node test.js <cmds.txt のパス>`: **変数が空（`plugins/Skript/variables.csv` なし）で始める**。15号館の設定が残っているとダンジョンの項目が失敗する
- `node drun.js <cmds.txt のパス> ../../tools/dungeon/layout`: 15号館（本番から取った建物）を再現したワールドで、2→9 階を通しで登る
- `node lights.js <cmds.txt のパス>`: 管理者ツールの「15号館のライトを置き直す」を平らなワールドで確かめる
- 2026-10-25 の結果: `test.js` 87/87、`drun.js` 93/93、`lights.js` 29/29
- この PC（Windows）のテストサーバーは `F:\Claude\testserver-1214`（15号館のワールドはないので `drun.js` は動かせない）。git の作者はこのリポジトリだけ `jtoxyz` に設定済み
- mineflayer の注意: 1.21.4 のしゃがみはパケットを直接送る（`test.js` の `sneak`）。アイテムを使う前に `deactivateItem`

## 今の状況（2026-10-25）

終わったこと:
- 本番サーバーを復旧（スクリプト 16 個がエラーなしで読み込まれた）
- 管理者ツールを本の画面にした。チェスト表示とも切り替えられる（main `9c0ca72`）

- ワールドのバックアップ: `/home/denken/workspace/world-backup-2026-10-25`（`world`・`world_nether`・`world_the_end`。15号館は `world`）
- Litematica で内装と闘技場を貼った（Prism Launcher のインスタンス「1.21.11」、中身は 1.21.4 + Litematica 0.21.7）。ただしライトブロックが置かれず、もとのライトも消えなかった → 管理者ツールに「15号館のライトを置き直す」を追加（ブランチ `fix-dungeon-lights`）
- Litematica は読み込まれたチャンクにしか貼れない。闘技場の 8・9 階（x -60〜14）が貼れていなかった

次にやること（ユーザーと一緒に）:
1. 闘技場の 8・9 階が貼れたか確認（だめなら `/tp @s -25 205 -20` のそばで貼り直す）
2. `fix-dungeon-lights` を main に入れて本番に届いたら、管理者ツール →「ダンジョンの各階」→「15号館のライトを置き直す」
3. 管理者ツールで「ワールドとロビー」→「受付・ショップ・カジノの区域」（受付）→「ダンジョンの各階」→「15号館の内装に合わせて全階を設定」→「モジュール」で dungeon・party・death をオン
4. 1 階の受付で `/dungeon` → 2 階から試す

あとでやること:
- サーバー側の認証情報（git の取得用トークン、RCON パスワード）の作り直し（部長と相談）
- 統合版で入れるかの確認（Geyser が起動時の認証で失敗している。前からの可能性が高い）
- サーバーと playit の自動起動にするか
- 未決定: Jecon とポイントを統一するか、CrackShot と独自の銃のどちらにするか、WorldGuard との連携、本番の SkQuery の版
