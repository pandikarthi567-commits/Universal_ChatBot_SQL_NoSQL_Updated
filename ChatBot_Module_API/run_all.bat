@echo off
setlocal
cd /d "%~dp0"

echo ================================================================
echo  Universal Chatbot API Platform
echo  1. Python NLP Microservice  -> http://localhost:8001
echo  2. Node.js Backend (MongoDB)-> http://localhost:8000
echo  3. React UI Studio (Vite)   -> http://localhost:5173
echo ================================================================

start "1. Python NLP Service (8001)" cmd /k call "%~dp0run_python_nlp.bat"
start "2. Node.js Backend API (8000)" cmd /k call "%~dp0run_backend.bat"
start "3. React UI Studio (5173)" cmd /k call "%~dp0run_frontend.bat"
