# Start the StreamRealm API server and the Expo web app together (Windows PowerShell).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path "server/.venv")) {
  python -m venv server/.venv
  & server/.venv/Scripts/python -m pip install -r server/requirements.txt
}
if (-not (Test-Path "app/node_modules")) { Push-Location app; npm install; Pop-Location }
$server = Start-Process -PassThru -NoNewWindow -WorkingDirectory "server" -FilePath "server/.venv/Scripts/python.exe" `
  -ArgumentList "-m", "uvicorn", "app.main:app", "--reload", "--port", "8000"
try {
  Push-Location app
  npx expo start --web
} finally {
  Pop-Location
  Stop-Process -Id $server.Id -ErrorAction SilentlyContinue
}
