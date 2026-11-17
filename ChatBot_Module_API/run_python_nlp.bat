@echo off
setlocal
cd /d "%~dp0python"

echo ==================================================
echo  Universal Chatbot - Python NLP Microservice
echo  Port: 8001 ^| Zero Database Connection
echo ==================================================

if not exist "..\.venv\Scripts\python.exe" (
    echo Virtual environment missing in parent directory.
    exit /b 1
)

"..\.venv\Scripts\uvicorn.exe" main:app --reload --host 0.0.0.0 --port 8001
