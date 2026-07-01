/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Path;

public final class RuntimePaths {

    private RuntimePaths() {
    }

    public static Path appDataDir() {
        return Path.of(System.getProperty("user.home"), ".npsharp");
    }

    public static Path configDir(Path appDataDir) {
        return appDataDir.resolve("config");
    }

    public static Path runtimesDir(Path appDataDir) {
        return appDataDir.resolve("runtimes");
    }

    public static Path toolsDir(Path appDataDir) {
        return appDataDir.resolve("tools");
    }

    public static Path toolBinDir(Path appDataDir) {
        return toolsDir(appDataDir).resolve("bin");
    }
}
