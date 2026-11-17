@echo off
setlocal
cd /d "%~dp0frontend"

echo ==================================================
echo  Universal Chatbot API Studio - React + Tailwind
echo ==================================================

if not exist "node_modules" (
    echo [1/2] Installing frontend dependencies...
    call npm install
    if errorlevel 1 (
        echo Failed to install frontend dependencies.
        exit /b 1
    )
) else (
    echo [1/2] Frontend dependencies already installed.
)

echo [2/2] Starting Vite dev server on http://localhost:5173 ...
call npm run dev

