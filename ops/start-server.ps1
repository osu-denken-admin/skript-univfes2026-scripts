<#
  サーバーの起動と自動再起動（Windows PowerShell 5.1 用）

  使い方:
    powershell -ExecutionPolicy Bypass -File ops\start-server.ps1 -ServerDir "D:\mcserver" -Jar "paper.jar"

  - サーバーが異常終了（終了コード 0 以外）したら自動で再起動する
  - -WindowMinutes 分以内に -MaxRestarts 回を超えて落ちた場合は、再起動をやめて通知する
  - ゲーム内やコンソールの stop で正常終了した場合（終了コード 0）は再起動しない
  - 通知先: 環境変数 UF_DISCORD_WEBHOOK に Discord の Webhook URL を入れておく（任意）
    ※ Webhook URL は秘密情報なので、このリポジトリには書かないこと
  - -BackupDir を指定すると、起動前に毎回 backup.ps1 を実行する
#>
param(
    [Parameter(Mandatory = $true)][string]$ServerDir,
    [string]$Jar = 'paper.jar',
    [string]$Java = 'java',
    [string]$Memory = '4G',
    [int]$MaxRestarts = 3,
    [int]$WindowMinutes = 10,
    [string]$BackupDir = ''
)

function Send-Notice([string]$text) {
    Write-Output "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $text"
    $hook = $env:UF_DISCORD_WEBHOOK
    if ($hook) {
        try {
            $body = @{ content = $text } | ConvertTo-Json
            $bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
            Invoke-RestMethod -Uri $hook -Method Post -ContentType 'application/json; charset=utf-8' -Body $bytes | Out-Null
        } catch {
            Write-Warning "通知に失敗しました: $($_.Exception.Message)"
        }
    }
}

$crashes = New-Object System.Collections.Generic.List[datetime]
Set-Location $ServerDir

while ($true) {
    if ($BackupDir) {
        try {
            & (Join-Path $PSScriptRoot 'backup.ps1') -ServerDir $ServerDir -BackupDir $BackupDir
        } catch {
            Send-Notice "バックアップに失敗しました: $($_.Exception.Message)"
        }
    }

    Send-Notice 'Minecraft サーバーを起動します'
    & $Java "-Xms$Memory" "-Xmx$Memory" -jar $Jar nogui
    $code = $LASTEXITCODE

    if ($code -eq 0) {
        Send-Notice 'サーバーが正常に停止しました（再起動しません）'
        break
    }

    $now = Get-Date
    $crashes.Add($now)
    $recent = @($crashes | Where-Object { $_ -gt $now.AddMinutes(-$WindowMinutes) })
    if ($recent.Count -gt $MaxRestarts) {
        Send-Notice "サーバーが ${WindowMinutes} 分以内に $($recent.Count) 回停止したため、自動再起動を中止しました。管理者の確認が必要です（終了コード $code）"
        break
    }
    Send-Notice "サーバーが異常終了しました（終了コード $code）。10 秒後に再起動します"
    Start-Sleep -Seconds 10
}
