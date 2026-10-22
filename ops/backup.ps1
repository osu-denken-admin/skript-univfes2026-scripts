<#
  Minecraft サーバーのバックアップ（Windows PowerShell 5.1 用）

  使い方:
    powershell -ExecutionPolicy Bypass -File ops\backup.ps1 -ServerDir "D:\mcserver" -BackupDir "E:\mc-backup"

  - ワールド（level-name と _nether / _the_end、Multiverse の追加ワールドは -Worlds で指定）
    と plugins フォルダ（Skript の変数・スクリプトを含む）を日時つきフォルダにコピーし、zip にする
  - 古いバックアップは -Keep 世代だけ残す
  - 空き容量が -MinFreeGB 未満なら中止する
  - サーバー稼働中に取る場合は、事前にゲーム内で save-all を実行しておくこと
    （確実にしたい場合は start-server.ps1 の停止中に取る）
  - 復元テストは docs/test-plan.md の手順で必ず行う
#>
param(
    [Parameter(Mandatory = $true)][string]$ServerDir,
    [Parameter(Mandatory = $true)][string]$BackupDir,
    [string[]]$Worlds = @(),
    [int]$Keep = 14,
    [int]$MinFreeGB = 5
)

$ErrorActionPreference = 'Stop'

if (-not (Test-Path $ServerDir)) { throw "ServerDir が見つかりません: $ServerDir" }
New-Item -ItemType Directory -Force -Path $BackupDir | Out-Null

# 空き容量の確認
$drive = (Get-Item $BackupDir).PSDrive
$freeGB = [math]::Floor($drive.Free / 1GB)
if ($freeGB -lt $MinFreeGB) { throw "空き容量が不足しています（${freeGB}GB < ${MinFreeGB}GB）" }

# 対象ワールドを決める
if ($Worlds.Count -eq 0) {
    $levelName = 'world'
    $props = Join-Path $ServerDir 'server.properties'
    if (Test-Path $props) {
        $line = Select-String -Path $props -Pattern '^level-name=' | Select-Object -First 1
        if ($line) { $levelName = $line.Line.Split('=', 2)[1].Trim() }
    }
    $Worlds = @($levelName, "${levelName}_nether", "${levelName}_the_end")
}

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$work = Join-Path $BackupDir "snapshot-$stamp"
New-Item -ItemType Directory -Force -Path $work | Out-Null

foreach ($w in $Worlds) {
    $src = Join-Path $ServerDir $w
    if (Test-Path $src) {
        robocopy $src (Join-Path $work $w) /E /R:1 /W:1 /NFL /NDL /NJH /NJS /XF session.lock | Out-Null
        if ($LASTEXITCODE -ge 8) { throw "コピーに失敗しました: $src (robocopy $LASTEXITCODE)" }
    }
}
$plugins = Join-Path $ServerDir 'plugins'
if (Test-Path $plugins) {
    robocopy $plugins (Join-Path $work 'plugins') /E /R:1 /W:1 /NFL /NDL /NJH /NJS /XD dynmap | Out-Null
    if ($LASTEXITCODE -ge 8) { throw "plugins のコピーに失敗しました (robocopy $LASTEXITCODE)" }
}
foreach ($f in @('server.properties', 'bukkit.yml', 'spigot.yml', 'ops.json', 'whitelist.json')) {
    $src = Join-Path $ServerDir $f
    if (Test-Path $src) { Copy-Item $src $work }
}

$zip = Join-Path $BackupDir "backup-$stamp.zip"
try {
    Compress-Archive -Path (Join-Path $work '*') -DestinationPath $zip -CompressionLevel Optimal
    Remove-Item -Recurse -Force $work
    Write-Output "バックアップ完了: $zip"
} catch {
    # 2GB を超えるファイルなどで zip 化に失敗した場合は、コピーしたフォルダをそのまま残す
    Write-Warning "zip 化に失敗したため、フォルダのまま残します: $work ($($_.Exception.Message))"
}

# 古い世代を削除（zip とフォルダの両方）
Get-ChildItem $BackupDir | Where-Object { $_.Name -like 'backup-*.zip' -or $_.Name -like 'snapshot-*' } |
    Sort-Object Name -Descending | Select-Object -Skip $Keep |
    ForEach-Object { Remove-Item -Recurse -Force $_.FullName; Write-Output "古いバックアップを削除: $($_.Name)" }
