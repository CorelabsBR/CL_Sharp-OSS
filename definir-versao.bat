@echo off
setlocal
cd /d "%~dp0"

echo.
echo Sharp-OSS - Definir versao antes do envio
echo Versao atual:
node -e "process.stdout.write(require('./config.json').application.version + '\n')"
echo.

set /p "SHARP_VERSION=Digite a nova versao (ex.: 1.0.1): "
if not defined SHARP_VERSION (
  echo Nenhuma versao informada. Operacao cancelada.
  exit /b 1
)

node scripts/set-version.mjs "%SHARP_VERSION%"
if errorlevel 1 exit /b %errorlevel%

call npm run typecheck
if errorlevel 1 (
  echo.
  echo A versao foi salva, mas o typecheck falhou. Corrija os erros antes de enviar.
  exit /b %errorlevel%
)

echo.
echo Versao %SHARP_VERSION% salva e validada localmente.
echo Agora voce pode revisar, commitar e enviar as alteracoes.
endlocal
