@echo off
echo Dung tat ca Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo Khoi dong Rank Checker Server...
cd /d "%~dp0"
npm start
