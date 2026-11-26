@echo off
title PARADOX - Where Vision Meets Capital
echo =================================================================
echo   PARADOX -- Where Vision Meets Capital
echo   Starting Institutional Full-Stack Engine...
echo =================================================================
echo.

set ELECTRON_RUN_AS_NODE=1
set PORT=3000

if exist "C:\Users\Sanja\AppData\Roaming\Antigravity\bin\agy-node.cmd" (
    call "C:\Users\Sanja\AppData\Roaming\Antigravity\bin\agy-node.cmd" src\server\server.js
) else (
    node src\server\server.js
)

pause
