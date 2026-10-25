# 本番サーバーの起動の仕組み

本番（`denken-mc`、ユーザー `denken`）で、サーバーと playit を自動で起動するためのファイルです。ここにあるのは控えで、本番では次の場所に置いてあります。

| ファイル | 本番の場所 |
|---|---|
| `run.sh` | `/home/denken/workspace/paper1214/run.sh` |
| `mc-server.service` | `/home/denken/.config/systemd/user/mc-server.service` |
| `playit.service` | `/home/denken/.config/systemd/user/playit.service` |

自動反映（`skript-git-pull.service` / `.timer`）と `~/.local/bin/update-skript-scripts.sh` はユーザーが作ったもので、RCON のパスワードが入っているので、ここには置きません。

## 仕組み

- systemd のユーザーのサービスとして動く。`loginctl enable-linger` を有効にしてあるので、マシンを再起動するとログインしなくても起動する
- サーバーと playit は今までどおり `screen` の中で動く（`screen -r mcserver` / `screen -r playit` で見られる）
- `run.sh` は WARP（プロキシのモード、`127.0.0.1:40000`）につないでから、Java の外向きの通信をそこに通して起動する。この回線はマイクラ関係の接続先を切るので、通さないと Geyser（統合版の入口）が起動できない。WARP が動いていなければ、プロキシなしで起動する

## 使い方

```bash
systemctl --user status mc-server playit
```
```bash
systemctl --user restart mc-server
```

- 止めるのは `systemctl --user stop mc-server`。ゲームやコンソールの `stop` だと 15 秒後にまた起動する
- 書き換えたら本番に写して `systemctl --user daemon-reload`。`run.sh` は、動いているサーバーを止めてから書き換える

## 2026-10-26 に入れたときの記録

- 前の `run.sh` は `run.sh.bak-2026-10-26` に残してある
- WARP は組織 `nyahello` への登録の設定が入っていたので `warp-cli settings reset` で外し、無料の登録（`registration new`）をして `mode proxy` にした
- 使われていなかった `worldedit-bukkit-7.4.0-beta-01.jar`（FAWE と名前がかぶる）を `plugins/_unused/` に移した
- 確かめたこと: Geyser が 19132 で起動し、統合版の問い合わせに返事をする / playit の 2 本のトンネルがつながる / Java 版で入れる / `systemctl --user stop` で保存してから止まり、勝手に起動し直さない
- まだのこと: マシンの再起動での確認、統合版の実機での確認
