@echo off
setlocal EnableExtensions

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%" >nul 2>nul
if errorlevel 1 (
    echo Erro: nao foi possivel acessar a raiz do repositorio.
    exit /b 1
)

if not exist "installer\NPSharp.iss" (
    echo Erro: installer\NPSharp.iss nao encontrado.
    popd
    exit /b 1
)

if not exist "dist\windows" (
    echo Erro: dist\windows nao encontrado. Execute scripts\build-windows.bat antes de empacotar.
    popd
    exit /b 1
)

if not exist "dist\windows\run-npsharp.bat" (
    echo Erro: dist\windows\run-npsharp.bat nao encontrado. Execute scripts\build-windows.bat antes de empacotar.
    popd
    exit /b 1
)

set "ISCC="
if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set "ISCC=%ProgramFiles%\Inno Setup 6\ISCC.exe"
if not defined ISCC for %%I in (ISCC.exe) do set "ISCC=%%~$PATH:I"

if not defined ISCC (
    echo Erro: Inno Setup Compiler ISCC.exe nao encontrado.
    echo Instale o Inno Setup 6 ou adicione ISCC.exe ao PATH.
    popd
    exit /b 1
)

if not exist "dist\installer" mkdir "dist\installer"

echo Compilando installer\NPSharp.iss...
"%ISCC%" "installer\NPSharp.iss"
if errorlevel 1 (
    echo Erro: falha ao compilar installer\NPSharp.iss.
    popd
    exit /b 1
)

echo Instalador gerado em dist\installer.

popd
exit /b 0
