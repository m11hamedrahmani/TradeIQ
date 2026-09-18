@echo off
setlocal
cd /d "%~dp0"

echo === TradeIQ launcher ===

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js is not installed.
    echo Download it from https://nodejs.org and re-run this script.
    pause
    exit /b 1
)

where docker >nul 2>nul
if errorlevel 1 (
    echo Docker is not installed.
    echo Download Docker Desktop from https://www.docker.com/products/docker-desktop and re-run this script.
    pause
    exit /b 1
)

docker info >nul 2>nul
if errorlevel 1 (
    echo Docker is installed but not running.
    echo Please start Docker Desktop, then re-run this script.
    pause
    exit /b 1
)

echo Starting Postgres...
docker compose up -d db

echo Waiting for Postgres to be ready...
:waitpg
docker compose exec -T db pg_isready -U tradeiq >nul 2>nul
if errorlevel 1 (
    timeout /t 1 /nobreak >nul
    goto waitpg
)
echo Postgres is ready.

if not exist "backend\.env" (
    copy "backend\.env.example" "backend\.env" >nul
    echo Created backend\.env
)

if not exist "backend\node_modules" (
    echo Installing backend dependencies...
    pushd backend
    call npm install
    popd
)

if not exist "frontend\node_modules" (
    echo Installing frontend dependencies...
    pushd frontend
    call npm install
    popd
)

echo Applying database migrations...
pushd backend
call npx prisma migrate deploy
popd

if not exist "backend\.seeded" (
    echo Seeding demo data ^(first run only^)...
    pushd backend
    call npm run seed
    popd
    type nul > backend\.seeded
)

echo Starting backend and frontend...
start "TradeIQ Backend" cmd /k "cd /d "%~dp0backend" && npm run dev"
start "TradeIQ Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo Waiting for servers to start...
timeout /t 5 /nobreak >nul

start http://localhost:5173

echo.
echo === TradeIQ is running ===
echo Demo login:
echo   email:    demo@tradeiq.app
echo   password: demo1234
echo.
pause
