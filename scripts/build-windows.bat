@echo off
setlocal EnableExtensions EnableDelayedExpansion

set "ROOT_DIR=%~dp0.."
pushd "%ROOT_DIR%" >nul 2>nul
if errorlevel 1 (
    echo Erro: nao foi possivel acessar a raiz do repositorio.
    exit /b 1
)

if not exist "pom.xml" (
    echo Erro: pom.xml nao encontrado. Execute este script a partir da raiz do repositorio.
    popd
    exit /b 1
)

where java >nul 2>nul
if errorlevel 1 (
    echo Erro: Java nao encontrado no PATH. Instale o JDK 17+ e tente novamente.
    popd
    exit /b 1
)

where mvn >nul 2>nul
if errorlevel 1 (
    echo Erro: Maven nao encontrado no PATH. Instale o Maven e tente novamente.
    popd
    exit /b 1
)

set "DIST_DIR=dist\windows"

echo Limpando %DIST_DIR%...
if exist "%DIST_DIR%" rmdir /s /q "%DIST_DIR%"

echo Executando mvn clean package...
call mvn clean package
if errorlevel 1 (
    echo Erro: mvn clean package falhou.
    popd
    exit /b 1
)

set "ARTIFACT="
for %%F in (target\*.jar) do (
    set "JAR_NAME=%%~nxF"
    if /I not "!JAR_NAME:~-12!"=="-sources.jar" if /I not "!JAR_NAME:~-12!"=="-javadoc.jar" if /I not "!JAR_NAME:~0,9!"=="original-" if not defined ARTIFACT set "ARTIFACT=%%F"
)

if not defined ARTIFACT (
    echo Erro: artefato JAR nao encontrado em target\.
    popd
    exit /b 1
)

if not exist "%ARTIFACT%" (
    echo Erro: artefato JAR invalido: %ARTIFACT%
    popd
    exit /b 1
)

mkdir "%DIST_DIR%\lib" >nul 2>nul
copy "%ARTIFACT%" "%DIST_DIR%\" >nul
if errorlevel 1 (
    echo Erro: falha ao copiar o JAR para %DIST_DIR%.
    popd
    exit /b 1
)

echo Copiando dependencias runtime...
call mvn -q org.apache.maven.plugins:maven-dependency-plugin:3.7.1:copy-dependencies -DincludeScope=runtime -DoutputDirectory="%DIST_DIR%\lib"
if errorlevel 1 (
    echo Erro: falha ao copiar dependencias runtime.
    popd
    exit /b 1
)

if exist "src\main\resources\icons" (
    xcopy "src\main\resources\icons" "%DIST_DIR%\icons\" /E /I /Y >nul
    if errorlevel 1 (
        echo Erro: falha ao copiar icones.
        popd
        exit /b 1
    )
)

for %%F in ("%ARTIFACT%") do set "FINAL_JAR=%%~nxF"

(
    echo @echo off
    echo setlocal
    echo set "APP_DIR=%%~dp0"
    echo javaw --module-path "%%APP_DIR%%lib" --add-modules javafx.controls,javafx.graphics,javafx.swing -cp "%%APP_DIR%%!FINAL_JAR!;%%APP_DIR%%lib\*" br.com.corelabs.npsharpfx.Main
    echo if errorlevel 1 pause
) > "%DIST_DIR%\run-npsharp.bat"

if not exist "%DIST_DIR%\%FINAL_JAR%" (
    echo Erro: artefato final nao existe: %DIST_DIR%\%FINAL_JAR%
    popd
    exit /b 1
)

echo Build Windows concluido em %DIST_DIR%.
echo Artefato: %DIST_DIR%\%FINAL_JAR%

popd
exit /b 0
