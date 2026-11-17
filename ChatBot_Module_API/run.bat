@echo off
setlocal
cd /d "%~dp0python"

echo ==================================================
echo  Universal Chatbot - Python NLP Microservice
echo  Port: 8001 ^| Zero Database Connection
echo ==================================================

"..\.venv\Scripts\uvicorn.exe" main:app --reload --host 0.0.0.0 --port 8001
