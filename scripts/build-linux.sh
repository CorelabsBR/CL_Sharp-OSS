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

DIST_DIR="dist/linux"

echo "Limpando ${DIST_DIR}..."
rm -rf "$DIST_DIR"

echo "Executando mvn clean package..."
mvn clean package || fail "mvn clean package falhou."

ARTIFACT="$(find target -maxdepth 1 -type f -name "*.jar" ! -name "*-sources.jar" ! -name "*-javadoc.jar" ! -name "original-*.jar" | sort | head -n 1 || true)"
[ -n "$ARTIFACT" ] || fail "Artefato JAR nao encontrado em target/."
[ -f "$ARTIFACT" ] || fail "Artefato JAR invalido: $ARTIFACT"

mkdir -p "$DIST_DIR/lib"
cp "$ARTIFACT" "$DIST_DIR/" || fail "Falha ao copiar o JAR para ${DIST_DIR}."

echo "Copiando dependencias runtime..."
mvn -q org.apache.maven.plugins:maven-dependency-plugin:3.7.1:copy-dependencies -DincludeScope=runtime -DoutputDirectory="$DIST_DIR/lib" || fail "Falha ao copiar dependencias runtime."

if [ -d "src/main/resources/icons" ]; then
    mkdir -p "$DIST_DIR/icons"
    cp -R src/main/resources/icons/. "$DIST_DIR/icons/" || fail "Falha ao copiar icones."
fi

JAR_NAME="$(basename "$ARTIFACT")"
cat > "$DIST_DIR/run-npsharp.sh" <<EOF
#!/usr/bin/env bash
set -euo pipefail
APP_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
java --module-path "\$APP_DIR/lib" --add-modules javafx.controls,javafx.graphics,javafx.swing -cp "\$APP_DIR/$JAR_NAME:\$APP_DIR/lib/*" br.com.corelabs.npsharpfx.Main
EOF
chmod +x "$DIST_DIR/run-npsharp.sh"

[ -s "$DIST_DIR/$JAR_NAME" ] || fail "Artefato final nao existe ou esta vazio: ${DIST_DIR}/${JAR_NAME}"

echo "Build Linux concluido em ${DIST_DIR}."
echo "Artefato: ${DIST_DIR}/${JAR_NAME}"
