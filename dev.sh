#!/usr/bin/env bash
# Start the StreamRealm API server and the Expo web app together (macOS / Linux).
set -e
cd "$(dirname "$0")"
if [ ! -d server/.venv ]; then
  python3 -m venv server/.venv
  server/.venv/bin/python -m pip install -r server/requirements.txt
fi
[ -d app/node_modules ] || (cd app && npm install)
(cd server && .venv/bin/python -m uvicorn app.main:app --reload --port 8000) &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT
cd app && npx expo start --web
