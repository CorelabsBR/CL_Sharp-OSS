/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.templates;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Objects;

public final class TemplateManager {

    private TemplateManager() {
    }

    public static String load(String template) throws IOException {
        String path = "/templates/java/" + template + ".java.tpl";

        try (InputStream in = TemplateManager.class.getResourceAsStream(path)) {

            if (in == null) {
                throw new IOException("Template não encontrado: " + path);
            }

            return new String(in.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    public static String apply(String template,
                               String packageName,
                               String className) throws IOException {

        return load(template)
                .replace("${PACKAGE}", Objects.requireNonNullElse(packageName, ""))
                .replace("${NAME}", Objects.requireNonNullElse(className, ""));
    }

}