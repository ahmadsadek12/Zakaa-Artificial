@echo off
echo ========================================
echo   Zakaa - Starting Full Application
echo ========================================
echo.

echo [1/2] Starting Backend Server...
start "Zakaa Backend" cmd /k "cd /d %~dp0 && node server.js"
timeout /t 3 /nobreak >nul

echo [2/2] Starting Frontend Server...
start "Zakaa Frontend" cmd /k "cd /d %~dp0\frontend && npm run dev"

echo.
echo ========================================
echo   Application Started!
echo ========================================
echo.
echo Backend:  http://localhost:3000
echo Frontend: http://localhost:5173
echo.
echo Press any key to exit this window...
pause >nul
