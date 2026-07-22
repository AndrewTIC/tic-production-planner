# start-planner.ps1 — one double-click to run the Production Planner.
# Make a desktop shortcut to this (see docs/run-locally.md). Starts Docker
# if needed, brings Supabase up (handling the stale-lock case after a
# reboot), then serves the app on this PC and the local network.

$ErrorActionPreference = "Continue"
$env:Path = "C:\Program Files\nodejs;" + $env:Path
Set-Location $PSScriptRoot

Write-Host "TIC Production Planner — starting..." -ForegroundColor Green

# 1. Docker
docker info 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Starting Docker Desktop (this can take a minute)..."
  Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
  do { Start-Sleep 5; docker info 2>$null | Out-Null } until ($LASTEXITCODE -eq 0)
}

# 2. Supabase (a killed Docker leaves a stale 'already running' lock —
#    a stop/start cycle clears it)
Write-Host "Starting Supabase..."
npx supabase start 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
  npx supabase stop 2>$null | Out-Null
  npx supabase start | Out-Null
}

# 3. The app, reachable from other machines on the network
$ip = (Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue |
  Where-Object { $_.IPAddress -notlike "127.*" -and $_.IPAddress -notlike "169.254*" -and $_.PrefixOrigin -ne "WellKnown" } |
  Select-Object -First 1).IPAddress

Write-Host ""
Write-Host "Open the planner at:" -ForegroundColor Green
Write-Host "   This PC:      http://localhost:3000"
if ($ip) { Write-Host "   Other PCs:    http://${ip}:3000   (share this one)" }
Write-Host ""
Write-Host "Leave this window open. Close it (Ctrl+C) to stop the app;"
Write-Host "the database keeps running until 'npx supabase stop'."
Write-Host ""

npx next dev -H 0.0.0.0
