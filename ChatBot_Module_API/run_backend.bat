@echo off
setlocal
cd /d "%~dp0backend"

echo ==================================================
echo  Universal Chatbot API - Node.js Backend
echo  Port: 8000 ^| Database: MongoDB Atlas
echo ==================================================

if not exist "node_modules" (
    echo Installing backend dependencies...
    call npm install
)

call npm start

