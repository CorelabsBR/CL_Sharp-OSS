/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.config;

public final class BuildMode {

    private BuildMode() {}

    public static boolean isDevelopment() {
        String cp = System.getProperty("java.class.path", "");

        return cp.contains("target/classes")
            || cp.contains("target\\classes")
            || cp.contains(".m2")
            || cp.contains("idea_rt.jar")
            || cp.contains("org.eclipse")
            || cp.contains("javafx-maven-plugin");
    }
}