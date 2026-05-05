# Download Buffalo_S ONNX model for Cowork face recognition.
#
# Source: Hugging Face mirror by immich-app (single 13.6 MB recognition
# model, no unzip needed). Original is the v0.7 release bundle from
# deepinsight/insightface (127 MB zip with detector + recognizer +
# landmark + age-gender models — overkill for V0).
#
# Places the file at %APPDATA%\codebuddy-cowork\models\buffalo_s.onnx,
# the path Cowork expects.
#
# Usage: right-click -> Run with PowerShell. No admin needed.

$ErrorActionPreference = 'Stop'

$Url    = 'https://huggingface.co/immich-app/buffalo_s/resolve/main/recognition/model.onnx'
$Target = Join-Path $env:APPDATA 'codebuddy-cowork\models\buffalo_s.onnx'

Write-Host "=== Cowork Buffalo_S model downloader ===" -ForegroundColor Cyan
Write-Host "Source : $Url"
Write-Host "Target : $Target"
Write-Host ""

if (Test-Path $Target) {
    $size = (Get-Item $Target).Length
    if ($size -gt 10MB) {
        Write-Host "[OK] Already present ($([Math]::Round($size/1MB,1)) MB) — nothing to do." -ForegroundColor Green
        Write-Host "     Delete the file and re-run if you want to refresh."
        Write-Host ""
        Write-Host "Press any key to close..." -ForegroundColor DarkGray
        $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
        return
    }
    Write-Host "[WARN] Existing file is suspiciously small ($size bytes), redownloading." -ForegroundColor Yellow
}

$dir = Split-Path $Target -Parent
if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir -Force | Out-Null
    Write-Host "[OK] Created $dir"
}

Write-Host "Downloading..."
try {
    Invoke-WebRequest -Uri $Url -OutFile $Target -UseBasicParsing
} catch {
    Write-Host "[FAIL] Download error: $($_.Exception.Message)" -ForegroundColor Red
    if (Test-Path $Target) { Remove-Item $Target -Force -ErrorAction SilentlyContinue }
    Write-Host ""
    Write-Host "Press any key to close..." -ForegroundColor DarkGray
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

$size = (Get-Item $Target).Length
if ($size -lt 10MB) {
    Write-Host "[FAIL] Downloaded file is $size bytes (expected ~13 MB). Removing." -ForegroundColor Red
    Remove-Item $Target -Force
    exit 1
}

Write-Host ""
Write-Host "[OK] Buffalo_S model installed ($([Math]::Round($size/1MB,1)) MB)" -ForegroundColor Green
Write-Host "     $Target"
Write-Host ""
Write-Host "Open Cowork, click the 👤 in the titlebar, enroll your face."
Write-Host ""
Write-Host "Press any key to close..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
