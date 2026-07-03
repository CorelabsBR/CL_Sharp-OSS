@echo off
setlocal EnableExtensions

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

echo Java:
java -version

echo Maven:
mvn -version

echo Iniciando NPSharp em modo dev...
call & "C:\Program Files\Apache NetBeans\java\maven\bin\mvn.cmd" clean javafx:run    
if errorlevel 1 (
    echo Erro: mvn clean javafx:run falhou.
    popd
    exit /b 1
)

popd
exit /b 0
