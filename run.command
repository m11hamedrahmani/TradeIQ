#!/bin/bash
# One-click launcher for TradeIQ (Mac). Double-click this file in Finder.
set -e
cd "$(dirname "$0")"
REPO_DIR="$(pwd)"

pause_and_exit() {
  read -r -p "Press Enter to close this window..."
  exit 1
}

echo "=== TradeIQ launcher ==="

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed."
  echo "Download it from https://nodejs.org and re-run this script."
  pause_and_exit
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is not installed."
  echo "Download Docker Desktop from https://www.docker.com/products/docker-desktop and re-run this script."
  pause_and_exit
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker is installed but not running."
  echo "Please start Docker Desktop, then re-run this script."
  pause_and_exit
fi

echo "Starting Postgres..."
docker compose up -d db

echo "Waiting for Postgres to be ready..."
until docker compose exec -T db pg_isready -U tradeiq >/dev/null 2>&1; do
  sleep 1
done
echo "Postgres is ready."

if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "Created backend/.env"
fi

if [ ! -d backend/node_modules ]; then
  echo "Installing backend dependencies..."
  (cd backend && npm install)
fi

if [ ! -d frontend/node_modules ]; then
  echo "Installing frontend dependencies..."
  (cd frontend && npm install)
fi

echo "Applying database migrations..."
(cd backend && npx prisma migrate deploy)

if [ ! -f backend/.seeded ]; then
  echo "Seeding demo data (first run only)..."
  (cd backend && npm run seed)
  touch backend/.seeded
fi

echo "Starting backend and frontend..."
osascript <<EOF
tell application "Terminal"
  do script "cd \"$REPO_DIR/backend\" && npm run dev"
  do script "cd \"$REPO_DIR/frontend\" && npm run dev"
end tell
EOF

echo "Waiting for servers to start..."
sleep 5

open http://localhost:5173

echo ""
echo "=== TradeIQ is running ==="
echo "Demo login:"
echo "  email:    demo@tradeiq.app"
echo "  password: demo1234"
echo ""
read -r -p "Press Enter to close this window..."
