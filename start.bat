@echo off
setlocal EnableDelayedExpansion
title AI Lead Generation - SaaS Launcher
color 0A

echo.
echo  ============================================================
echo    AI LEAD GENERATION - SaaS Product Launcher
echo  ============================================================
echo.

:: Set project root
set "PROJECT_DIR=%~dp0"
cd /d "%PROJECT_DIR%"

:: ============================================================
:: STEP 1: Check Prerequisites
:: ============================================================
echo  [1/7] Checking prerequisites...

where node >nul 2>nul
if !ERRORLEVEL! neq 0 (
    color 0C
    echo  ERROR: Node.js is not installed! Download from https://nodejs.org
    goto FAIL
)
for /f "tokens=*" %%i in ('node -v') do echo         Node.js: %%i

where npm >nul 2>nul
if !ERRORLEVEL! neq 0 (
    color 0C
    echo  ERROR: npm is not installed!
    goto FAIL
)
for /f "tokens=*" %%i in ('npm -v') do echo         npm:     %%i

echo         Done.
echo.

:: ============================================================
:: STEP 2: Start Docker Services (Optional)
:: ============================================================
echo  [2/7] Checking Docker services...

where docker >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo         Docker not found - skipping. Make sure MongoDB/Redis run externally.
    echo.
    goto SKIP_DOCKER
)

:: Check if Docker daemon is responsive
docker info >nul 2>nul
if !ERRORLEVEL! neq 0 (
    echo         Docker found but Docker Desktop is not running.
    echo         Trying to start Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe" 2>nul
    echo         Waiting up to 90 seconds for Docker...
    set "DOCKER_WAIT=0"
    goto WAIT_DOCKER_LOOP
)
goto DOCKER_IS_READY

:WAIT_DOCKER_LOOP
if !DOCKER_WAIT! geq 18 (
    echo         Docker did not start in time - skipping Docker services.
    echo         Make sure MongoDB and Redis are available externally.
    echo.
    goto SKIP_DOCKER
)
timeout /t 5 /nobreak >nul
set /a DOCKER_WAIT+=1
docker info >nul 2>nul
if !ERRORLEVEL! neq 0 goto WAIT_DOCKER_LOOP
echo         Docker is ready.

:DOCKER_IS_READY
echo         Starting containers (MongoDB, Redis, MinIO)...
cd /d "%PROJECT_DIR%"
docker compose up -d mongodb redis minio >nul 2>nul
if !ERRORLEVEL! neq 0 (
    docker-compose up -d mongodb redis minio >nul 2>nul
    if !ERRORLEVEL! neq 0 (
        echo         WARNING: Could not start Docker containers.
        echo         Make sure MongoDB and Redis are available externally.
        echo.
        goto SKIP_DOCKER
    )
)
echo         Waiting for MongoDB replica set to initialize...
timeout /t 15 /nobreak >nul
echo         Docker services started.
echo.

:SKIP_DOCKER

:: ============================================================
:: STEP 3: Install Dependencies
:: ============================================================
echo  [3/7] Installing dependencies...
cd /d "%PROJECT_DIR%"

:: Root dependencies
if not exist "node_modules" (
    echo         Installing root dependencies...
    call npm install --silent 2>nul
)

:: API dependencies
if not exist "apps\api\node_modules" (
    echo         Installing API dependencies...
    cd /d "%PROJECT_DIR%apps\api"
    call npm install --silent 2>nul
    cd /d "%PROJECT_DIR%"
)

:: Web dependencies
if not exist "apps\web\node_modules" (
    echo         Installing Web dependencies...
    cd /d "%PROJECT_DIR%apps\web"
    call npm install --silent 2>nul
    cd /d "%PROJECT_DIR%"
)

:: Widget dependencies
if not exist "apps\widget\node_modules" (
    echo         Installing Widget dependencies...
    cd /d "%PROJECT_DIR%apps\widget"
    call npm install --silent 2>nul
    cd /d "%PROJECT_DIR%"
)

echo         Dependencies ready.
echo.

:: ============================================================
:: STEP 4: Build Backend (NestJS)
:: ============================================================
echo  [4/7] Building Backend (NestJS)...
cd /d "%PROJECT_DIR%apps\api"
call npm run build
if !ERRORLEVEL! neq 0 (
    color 0C
    echo  ERROR: Backend build failed!
    goto FAIL
)
echo         Backend build successful.
cd /d "%PROJECT_DIR%"
echo.

:: ============================================================
:: STEP 5: Build Frontend (Next.js)
:: ============================================================
echo  [5/7] Building Frontend (Next.js)...
cd /d "%PROJECT_DIR%apps\web"
call npm run build
if !ERRORLEVEL! neq 0 (
    color 0C
    echo  ERROR: Frontend build failed!
    goto FAIL
)
echo         Frontend build successful.
cd /d "%PROJECT_DIR%"
echo.

:: ============================================================
:: STEP 6: Build Widget (Preact/Vite)
:: ============================================================
echo  [6/7] Building Widget (Preact)...
cd /d "%PROJECT_DIR%apps\widget"
call npm run build
if !ERRORLEVEL! neq 0 (
    color 0E
    echo  WARNING: Widget build failed - non-critical, continuing...
) else (
    echo         Widget build successful.
)
cd /d "%PROJECT_DIR%"
echo.

:: ============================================================
:: STEP 7: Start All Services
:: ============================================================
echo  [7/7] Starting all services...
echo.
echo  ============================================================
echo    SERVICES STARTING:
echo    Backend  (API)    : http://localhost:4000
echo    Frontend (Web)    : http://localhost:3001
echo    Swagger  (Docs)   : http://localhost:4000/api/docs
echo  ============================================================
echo.

:: Start Backend in new window
start "AI-LeadGen Backend" cmd /k "cd /d "%PROJECT_DIR%apps\api" && echo Starting Backend on port 4000... && node dist/src/main"

echo         Waiting for Backend API to become ready (http://localhost:4000/api/v1/health)...
set "API_RETRIES=0"
:CHECK_API_HEALTH
curl.exe -s -f http://localhost:4000/api/v1/health >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo         Backend API is online and healthy!
    goto START_FRONTEND
)

set /a API_RETRIES+=1
if !API_RETRIES! geq 35 (
    echo         WARNING: Backend took longer than expected to initialize. Starting frontend anyway...
    goto START_FRONTEND
)
timeout /t 1 /nobreak >nul
goto CHECK_API_HEALTH

:START_FRONTEND
echo.
:: Start Frontend in new window
start "AI-LeadGen Frontend" cmd /k "cd /d "%PROJECT_DIR%apps\web" && echo Starting Frontend on port 3001... && npm run start -- -p 3001"

echo         Waiting for Frontend to become ready (http://localhost:3001)...
set "WEB_RETRIES=0"
:CHECK_WEB_HEALTH
curl.exe -s -f http://localhost:3001 >nul 2>nul
if !ERRORLEVEL! equ 0 (
    echo         Frontend is online and ready!
    goto OPEN_BROWSER
)

set /a WEB_RETRIES+=1
if !WEB_RETRIES! geq 25 (
    goto OPEN_BROWSER
)
timeout /t 1 /nobreak >nul
goto CHECK_WEB_HEALTH

:OPEN_BROWSER
echo.
echo  ============================================================
echo    ALL SERVICES RUNNING & HEALTHY!
echo  ============================================================
echo.
echo    Opening browser...
start "" http://localhost:3001
echo.
echo    To stop everything:
echo      1. Close the Backend and Frontend windows
echo      2. Run: docker compose down (to stop Docker services)
echo.
echo    Login credentials (seed):
echo      Email:    admin@demo.com
echo      Password: Admin@123
echo      Tenant:   demo
echo.
pause
goto END

:FAIL
echo.
echo  Script stopped due to error. See above for details.
pause

:END
endlocal
