package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Files;
import java.nio.file.Path;

public class RuntimeBootstrap {

    private final Path root;

    public RuntimeBootstrap() {
        this.root = Path.of(
                System.getProperty("user.home"),
                ".npsharp"
        );
    }

    public RuntimeRegistry boot() throws Exception {

        Files.createDirectories(root);

        RuntimeConfigStore store =
                new RuntimeConfigStore(root);

        if (!store.exists()) {

            RuntimeInstallerService installer =
                    new RuntimeInstallerService(root);

            return installer.installAll();
        }

        return store.load();
    }
}