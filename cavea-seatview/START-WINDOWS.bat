@echo off
cd /d "%~dp0server"
start "" http://localhost:3000
node server.js
pause
