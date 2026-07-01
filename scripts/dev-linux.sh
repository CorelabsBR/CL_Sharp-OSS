#!/usr/bin/env bash
set -euo pipefail

fail() {
    echo "Erro: $*" >&2
    exit 1
}

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

[ -f "pom.xml" ] || fail "pom.xml nao encontrado. Execute este script a partir da raiz do repositorio."

command -v java >/dev/null 2>&1 || fail "Java nao encontrado no PATH. Instale o JDK 17+ e tente novamente."
command -v mvn >/dev/null 2>&1 || fail "Maven nao encontrado no PATH. Instale o Maven e tente novamente."

echo "Java:"
java -version

echo "Maven:"
mvn -version

echo "Iniciando NPSharp em modo dev..."
mvn clean javafx:run || fail "mvn clean javafx:run falhou."
