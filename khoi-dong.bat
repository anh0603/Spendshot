@echo off
REM SpendShot - khoi dong local (2 cua so rieng, tat cua so la tat server)
start "SpendShot Backend" cmd /k "cd /d %~dp0backend && python -m uvicorn app.main:app --host 127.0.0.1 --port 8000"
start "SpendShot Frontend" cmd /k "cd /d %~dp0frontend && npm run preview -- --port 5173 --host 127.0.0.1"
echo.
echo  Da khoi dong xong! Mo trinh duyet:
echo    App: http://localhost:5173/welcome
echo    API: http://localhost:8000/docs
echo.
echo  Luu y: sau khi doi code frontend, chay "npm run build" trong thu muc frontend truoc.
pause
