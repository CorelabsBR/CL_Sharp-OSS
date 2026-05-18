package br.com.corelabs.npsharpfx.backend.runtime;

import br.com.corelabs.npsharpfx.backend.runtime.installers.JavaRuntimeInstaller;
import br.com.corelabs.npsharpfx.backend.runtime.installers.NodeRuntimeInstaller;
import br.com.corelabs.npsharpfx.backend.runtime.installers.PythonRuntimeInstaller;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public class RuntimeInstallerService {

    private final List<RuntimeInstaller> installers = new ArrayList<>();

    private final RuntimeConfigStore configStore;

    public RuntimeInstallerService(Path root) {

        this.configStore = new RuntimeConfigStore(root);

        installers.add(new NodeRuntimeInstaller(root));
        installers.add(new PythonRuntimeInstaller(root));
        installers.add(new JavaRuntimeInstaller(root));
    }

    public RuntimeRegistry installAll() throws Exception {

        RuntimeRegistry registry = new RuntimeRegistry();

        for (RuntimeInstaller installer : installers) {

            RuntimeInfo info = installer.install();

            registry.register(info);
        }

        configStore.save(registry);

        return registry;
    }
}