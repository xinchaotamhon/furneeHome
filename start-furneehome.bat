@echo off
setlocal

set "PROJECT_DIR=%~dp0"

if not exist "%PROJECT_DIR%server\package.json" (
  echo Khong tim thay thu muc server.
  pause
  exit /b 1
)

if not exist "%PROJECT_DIR%client\package.json" (
  echo Khong tim thay thu muc client.
  pause
  exit /b 1
)

echo Dang khoi dong backend FurneeHome...
start "FurneeHome Backend" /D "%PROJECT_DIR%server" cmd /k npm run dev

echo Dang khoi dong frontend FurneeHome...
cd /d "%PROJECT_DIR%client"
npm run dev

endlocal
