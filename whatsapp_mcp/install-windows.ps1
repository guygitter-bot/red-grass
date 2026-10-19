# התקנת ווטסאפ ל-Claude Desktop בווינדוס. הרצה ב-PowerShell:
#   powershell -ExecutionPolicy Bypass -c "irm https://raw.githubusercontent.com/guygitter-bot/red-grass/main/whatsapp_mcp/install-windows.ps1 | iex"
$ErrorActionPreference = 'Stop'

# גרסה קבועה של הקוד המקורי (נבדקה) – לא מושכים שינויים לא מוכרים
$Upstream = 'https://github.com/lharries/whatsapp-mcp.git'
$Commit = '7d6a06dcdce1f01dfb24f60e1030d5efba9f3b88'
$Raw = 'https://raw.githubusercontent.com/guygitter-bot/red-grass/main/whatsapp_mcp'
$Dir = Join-Path $HOME 'whatsapp-mcp'
$Config = Join-Path $env:APPDATA 'Claude\claude_desktop_config.json'
# Claude מחנות מיקרוסופט שומר את ההגדרות בתיקייה אחרת
$Store = Get-ChildItem "$env:LOCALAPPDATA\Packages" -Directory -Filter 'Claude_*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($Store) { $Config = Join-Path $Store.FullName 'LocalCache\Roaming\Claude\claude_desktop_config.json' }

function Say($t) { Write-Host "`n==> $t" -ForegroundColor Cyan }
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User')
}
function Need($cmd, $id) {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) {
    Say "Installing $id"
    winget install -e --id $id --accept-source-agreements --accept-package-agreements
    Refresh-Path
  }
}

# כלים: git, uv, go, ומהדר C (חובה בווינדוס בשביל מסד הנתונים של הגשר)
Need git 'Git.Git'
Need uv 'astral-sh.uv'
Need go 'GoLang.Go'
Need gcc 'BrechtSanders.WinLibs.POSIX.UCRT'

Say "Downloading code to $Dir"
if (-not (Test-Path (Join-Path $Dir '.git'))) { git clone -q $Upstream $Dir }
git -C $Dir fetch -q origin $Commit
git -C $Dir checkout -q --force $Commit

Say 'Configuring'
$Local = if ($PSScriptRoot) { Join-Path $PSScriptRoot 'configure.py' } else { '' }
if ($Local -and (Test-Path $Local)) { Copy-Item $Local "$Dir\configure.py" }
else { Invoke-WebRequest "$Raw/configure.py" -OutFile "$Dir\configure.py" -UseBasicParsing }
$Uv = (Get-Command uv).Source
uv run --no-project python "$Dir\configure.py" $Dir $Config $Uv
if ($LASTEXITCODE) { throw 'configure failed' }

Say 'Building the bridge (a few minutes the first time)'
$env:CGO_ENABLED = '1'
Push-Location "$Dir\whatsapp-bridge"
go build -o whatsapp-bridge.exe .
if ($LASTEXITCODE) { Pop-Location; throw 'build failed' }
Pop-Location

# קובץ הפעלה בלחיצה כפולה
Set-Content -Path "$Dir\start-whatsapp.bat" -Encoding ASCII -Value "@echo off`r`ncd /d `"$Dir\whatsapp-bridge`"`r`nwhatsapp-bridge.exe`r`npause"

Say 'Ready! Scan the QR code: WhatsApp > Settings > Linked devices > Link a device.'
Say 'Then fully quit Claude Desktop and open it again. Keep this window open.'
& "$Dir\start-whatsapp.bat"
