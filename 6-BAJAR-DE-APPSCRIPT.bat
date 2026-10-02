@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
call _config.bat
title Bajar de Apps Script

set "ESC="
for /f %%E in ('echo prompt $E ^| cmd') do set "ESC=%%E"
set "AZUL="
set "VERDE="
set "ROJO="
set "FIN="
if defined ESC set "AZUL=%ESC%[38;2;31;148;249m"
if defined ESC set "VERDE=%ESC%[38;2;63;185;80m"
if defined ESC set "ROJO=%ESC%[38;2;248;81;73m"
if defined ESC set "FIN=%ESC%[0m"

echo.
echo   BAJAR DE APPS SCRIPT        el editor pisa la carpeta
echo   %AZUL%----------------------------------------------------%FIN%
echo.

if not exist ".clasp.json" goto NOCONFIG
findstr /C:"PON_AQUI" .clasp.json >nul 2>&1
if not errorlevel 1 goto NOSCRIPTID
where clasp >nul 2>&1
if errorlevel 1 goto NOCLASP

REM Si ya hay .gs en la carpeta, clasp pull los reemplaza por lo que
REM tenga el editor. Se avisa antes.
set ANTES=0
for %%F in (apps-script\*.gs) do set /a ANTES+=1
if "!ANTES!"=="0" goto BAJAR
echo   %ROJO%^^!  SE VAN A REEMPLAZAR !ANTES! ARCHIVOS LOCALES%FIN%
echo.
pause

:BAJAR
echo   %AZUL%[1/1]%FIN%  Bajando con clasp . . . . . . . . .
call clasp pull >nul 2>"%TEMP%\cva_e.txt"
if errorlevel 1 goto PULLFAIL

REM Comprobacion contra la realidad: tiene que existir el manifiesto
REM y al menos un .gs, o no se pinta verde.
if not exist "apps-script\appsscript.json" goto VACIO
set ARCHIVOS=0
for %%F in (apps-script\*.gs apps-script\*.html) do set /a ARCHIVOS+=1
if "!ARCHIVOS!"=="0" goto VACIO
echo          !ARCHIVOS! archivos

echo.
echo   %AZUL%----------------------------------------------------%FIN%
echo.
echo %VERDE%  Backend bajado a apps-script.%FIN%
echo.
call :LOGO
exit /b 0

:NOCONFIG
echo   %ROJO%x  NO ENCUENTRO .clasp.json%FIN%
echo.
pause
exit /b 1

:NOSCRIPTID
echo   %ROJO%x  EL scriptId SIGUE EN PLACEHOLDER%FIN%
echo      Ponlo en .clasp.json: sale de la URL del editor, entre /projects/ y /edit
echo.
pause
exit /b 1

:NOCLASP
echo   %ROJO%x  NO TIENES CLASP%FIN%
echo      Corre 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:PULLFAIL
echo          fallo
echo.
type "%TEMP%\cva_e.txt"
echo.
echo   %ROJO%x  FALLO EL PULL%FIN%
echo      API apagada o sesion caducada: 1-INSTALAR-CLASP.bat
echo.
pause
exit /b 1

:VACIO
echo          vacio
echo.
echo   %ROJO%x  NO LLEGO NADA A apps-script%FIN%
echo      Revisa que el scriptId sea el del proyecto CVA.
echo.
pause
exit /b 1

:LOGO
where node >nul 2>&1
if errorlevel 1 goto SINLOGO
if not exist "%~dp0logo-animado.js" goto SINLOGO
node "%~dp0logo-animado.js" giro marca 0 12
goto :eof

:SINLOGO
pause
goto :eof
