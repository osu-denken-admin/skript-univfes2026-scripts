#!/bin/sh
# 本番のサーバーの起動（/home/denken/workspace/paper1214/run.sh に置く）
#   systemd の mc-server.service が screen「mcserver」の中でこれを動かす。手で動かしても同じ
#   この回線はマイクラ関係の接続先（Mojang・minecraft-services.net など）を切るので、
#   Java の外向きの通信を WARP のプロキシ（127.0.0.1:40000）に通す。通さないと Geyser が起動できず統合版が入れない
#   WARP はプロキシのモード（warp-cli mode proxy）なので、playit や Tailscale の経路は変わらない
cd /home/denken/workspace/paper1214

warp-cli --accept-tos connect >/dev/null 2>&1
i=0
while [ $i -lt 20 ] && ! ss -ltn | grep -q "127.0.0.1:40000"; do
  sleep 1
  i=$((i + 1))
done

PROXY=""
if ss -ltn | grep -q "127.0.0.1:40000"; then
  PROXY="-DsocksProxyHost=127.0.0.1 -DsocksProxyPort=40000"
else
  echo "WARP のプロキシが動いていないので、プロキシなしで起動します（統合版は入れません）"
fi

exec java $PROXY -jar paper-1.21.4-232.jar --nogui
