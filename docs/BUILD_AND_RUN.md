# Build e Execução do NPSharp

## Requisitos

### Obrigatórios
- **Java Development Kit (JDK) 17+**
  ```bash
  java -version  # Verificar versão
  ```
- **Maven 3.8.0+**
  ```bash
  mvn -version  # Verificar versão
  ```
- **Git**
  ```bash
  git --version  # Verificar versão
  ```

### Recomendados
- **4GB+ RAM** para build e execução
- **10GB+ espaço em disco** para repositório completo
- **Conexão de internet** para download de dependências

### Sistema Operacional
- ✅ Linux (Ubuntu, Fedora, Arch, etc.)
- ✅ Windows 10+
- ✅ macOS 10.14+

## Setup Inicial

### 1. Clonar Repositório
```bash
git clone https://github.com/CorelabsBR/CL_NPSharp.git
cd CL_NPSharp/NPSharpfx
```

### 2. Verificar Dependências
```bash
# Java
java -version
# Esperado: openjdk version "17" ou superior

# Maven
mvn -version
# Esperado: Apache Maven 3.8.0 ou superior

# Git
git --version
```

### 3. Atualizar Dependências Maven (Opcional)
```bash
# Baixar todas as dependências antecipadamente
mvn dependency:resolve
```

## Desenvolvimento

### Executar em Modo Desenvolvimento

#### Linux/macOS
```bash
bash scripts/dev-linux.sh
```

#### Windows
```cmd
scripts\dev-windows.bat
```

**O que o script faz:**
1. Verifica Java e Maven instalados
2. Executa `mvn clean javafx:run`
3. Abre aplicação em modo dev

**Modo dev oferece:**
- Título "NPSharp [DEV]" na janela
- Ícone de desenvolvimento (dev.png)
- Rebuild rápido
- Logs mais verbosos

### Build para Desenvolvimento

```bash
mvn clean compile
```

**Saída:**
- Arquivos compilados em `target/classes/`
- Sem criar JAR executável
- Rápido para iteração

## Build para Distribuição

### Build Completo

```bash
mvn clean package
```

**O que faz:**
1. Compila código-fonte
2. Executa testes (se houver)
3. Cria JAR executável em `target/`
4. Cria estrutura no `dist/`

### Build por Sistema Operacional

#### Linux
```bash
bash scripts/build-linux.sh
```

**Saída:**
- `dist/linux/npsharpfx-1.0-SNAPSHOT.jar`
- `dist/linux/lib/` - Dependências
- `dist/linux/run-npsharp.sh` - Script de execução
- `dist/linux/icons/` - Ícones

#### Windows
```cmd
scripts\build-windows.bat
```

**Saída:**
- `dist\windows\npsharpfx-1.0-SNAPSHOT.jar`
- `dist\windows\lib\` - Dependências
- `dist\windows\run-npsharp.exe` - Executável
- `dist\windows\icons\` - Ícones

#### macOS
```bash
bash scripts/build-linux.sh  # Similar ao Linux
```

## Execução

### Após Build Local (Desenvolvimento)

```bash
# Via Maven (mais rápido)
mvn javafx:run

# Via script dev
bash scripts/dev-linux.sh      # Linux/macOS
scripts\dev-windows.bat        # Windows
```

### Após Build em Distribuição

#### Linux/macOS
```bash
# Via script gerado
dist/linux/run-npsharp.sh

# Ou diretamente
java --module-path dist/linux/lib \
  --add-modules javafx.controls,javafx.graphics,javafx.swing \
  -cp dist/linux/npsharpfx-1.0-SNAPSHOT.jar:dist/linux/lib/* \
  br.com.corelabs.npsharpfx.Main
```

#### Windows
```cmd
# Via executável
dist\windows\run-npsharp.exe

# Ou direto no terminal
java --module-path dist\windows\lib ^
  --add-modules javafx.controls,javafx.graphics,javafx.swing ^
  -cp dist\windows\npsharpfx-1.0-SNAPSHOT.jar;dist\windows\lib\* ^
  br.com.corelabs.npsharpfx.Main
```

## Testes

### Executar Testes
```bash
mvn test
```

### Executar Testes Específicos
```bash
# Teste único
mvn test -Dtest=EditorManagerTest

# Classe inteira
mvn test -Dtest=br.com.corelabs.npsharpfx.frontend.ui.editor.*
```

### Pular Testes no Build
```bash
mvn clean package -DskipTests
```

## Troubleshooting de Build

### Problema: "java: command not found"

**Causa:** Java não instalado ou não no PATH

**Solução:**
```bash
# Linux/macOS - Instalar Java 17
sudo apt install openjdk-17-jdk  # Ubuntu/Debian
brew install openjdk@17          # macOS

# Windows - Download em https://adoptopenjdk.net/

# Verificar
java -version
```

### Problema: "mvn: command not found"

**Causa:** Maven não instalado ou não no PATH

**Solução:**
```bash
# Linux/macOS
sudo apt install maven  # Ubuntu/Debian
brew install maven      # macOS

# Windows - Download em https://maven.apache.org/

# Verificar
mvn -version
```

### Problema: "ERROR: Could not find or load main class"

**Causa:** Classpath incorreto ou JAR mal construído

**Solução:**
```bash
# Limpar build anterior
rm -rf target dist

# Reconstruir
mvn clean package

# Verificar arquivo JAR
jar -tf target/npsharpfx-1.0-SNAPSHOT.jar | grep Main.class
# Deve retornar: br/com/corelabs/npsharpfx/Main.class
```

### Problema: "Exception in thread... UnsupportedClassVersionError"

**Causa:** Versão de Java incompatível

**Solução:**
```bash
# Verificar versão
java -version

# Necessário: Java 17 ou superior
# Se Java 11:
sudo apt remove openjdk-11-jdk
sudo apt install openjdk-17-jdk

# Definir como padrão
sudo update-alternatives --config java
```

### Problema: BUILD FAILURE - Compilação falha

**Causa:** Erro no código-fonte ou dependência faltante

**Solução:**
```bash
# Ver log completo
mvn clean package -X 2>&1 | tail -50

# Limpar cache Maven
rm -rf ~/.m2/repository

# Tentar novamente (vai baixar tudo)
mvn clean package
```

### Problema: "No GUI environment available"

**Causa:** Executar em servidor sem display (SSH/headless)

**Solução:**
```bash
# Usar Xvfb (X virtual framebuffer)
xvfb-run -a mvn javafx:run

# Ou usar display remoto
export DISPLAY=:0
mvn javafx:run
```

### Problema: Aplicação lenta ou travando

**Causa:** Falta de memória ou dependências conflitando

**Solução:**
```bash
# Aumentar memória heap
java -Xmx2g -Xms1g --module-path ... \
  -cp ... br.com.corelabs.npsharpfx.Main

# Ou via variável de ambiente
export JAVA_OPTS="-Xmx2g"
mvn javafx:run
```

### Problema: "error: module not found: javafx.controls"

**Causa:** Módulos JavaFX não configurados

**Solução:**
```bash
# Verificar pom.xml tem dependências JavaFX
grep -A2 "javafx" pom.xml

# Se faltando, adicionar:
# <dependency>
#   <groupId>org.openjfx</groupId>
#   <artifactId>javafx-controls</artifactId>
#   <version>21.0.2</version>
# </dependency>

# Reconstruir
mvn clean package
```

## Flags de Execução Avançadas

### Modo Debug JVM
```bash
mvn javafx:run -Dmaven.surefire.debug
```

### Otimizar Performance
```bash
java -Xmx4g -XX:+UseG1GC -XX:+UseStringDeduplication \
  --module-path lib \
  -cp npsharpfx-1.0-SNAPSHOT.jar:lib/* \
  br.com.corelabs.npsharpfx.Main
```

### Profiling
```bash
java -XX:+UnlockCommercialFeatures -XX:+FlightRecorder \
  --module-path lib \
  -cp npsharpfx-1.0-SNAPSHOT.jar:lib/* \
  br.com.corelabs.npsharpfx.Main
```

## POM.xml - Estrutura Principal

Arquivo: [pom.xml](../pom.xml)

```xml
<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>br.com.corelabs</groupId>
  <artifactId>npsharpfx</artifactId>
  <version>1.0-SNAPSHOT</version>
  
  <properties>
    <maven.compiler.source>17</maven.compiler.source>
    <maven.compiler.target>17</maven.compiler.target>
    <javafx.version>21.0.2</javafx.version>
  </properties>
  
  <dependencies>
    <!-- JavaFX -->
    <dependency>
      <groupId>org.openjfx</groupId>
      <artifactId>javafx-controls</artifactId>
      <version>${javafx.version}</version>
    </dependency>
    
    <!-- Outras dependências -->
    ...
  </dependencies>
</project>
```

## Scripts de Automação

### Build Completo Linux
Arquivo: [build-linux.sh](../scripts/build-linux.sh)

```bash
#!/bin/bash
# 1. Valida Java e Maven
# 2. Limpa build anterior
# 3. Executa mvn clean package
# 4. Cria estrutura em dist/linux/
# 5. Gera script run-npsharp.sh
```

### Desenvolvimento Linux
Arquivo: [dev-linux.sh](../scripts/dev-linux.sh)

```bash
#!/bin/bash
# 1. Valida Java e Maven
# 2. Executa mvn clean javafx:run
# 3. Abre NPSharp em modo dev
```

## Workflow Recomendado

### Para Desenvolvimento Rápido
```bash
# 1. Primeira execução
bash scripts/dev-linux.sh

# 2. Fazer mudanças no código
# (Editar arquivos .java em src/)

# 3. Recompilar (Maven incrementalmente detecta mudanças)
mvn clean compile

# 4. Executar novamente
mvn javafx:run
```

### Para Build Release
```bash
# 1. Limpar tudo
mvn clean

# 2. Build completo
bash scripts/build-linux.sh

# 3. Testar executável
dist/linux/run-npsharp.sh

# 4. Se OK, arquivos prontos em dist/
# Distribuir: dist/linux/ inteiro
```

### Para CI/CD
```bash
# Build sem testes (mais rápido)
mvn clean package -DskipTests

# Ou com testes
mvn clean package

# Artefato final
target/npsharpfx-1.0-SNAPSHOT.jar
```

## Variáveis de Build

### Maven
```bash
# Skip tests
mvn package -DskipTests

# Modo offline (sem internet)
mvn package -o

# Verbosidade
mvn package -X  # Debug
mvn package -q  # Quiet
```

## Documentação Relacionada

- [ARCHITECTURE.md](./ARCHITECTURE.md) - Arquitetura do sistema
- [CONFIGURATION.md](./CONFIGURATION.md) - Configurações em runtime

---

**Última atualização:** 2026-07-02
