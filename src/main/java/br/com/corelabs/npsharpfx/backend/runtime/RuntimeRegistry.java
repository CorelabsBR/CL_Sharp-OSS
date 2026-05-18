package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

public class RuntimeRegistry {

    private final Map<String, RuntimeInfo> runtimes = new HashMap<>();

    public void register(RuntimeInfo info) {
        runtimes.put(info.id(), info);
    }

    public RuntimeInfo get(String id) {
        RuntimeInfo runtime = runtimes.get(id);

        if (runtime == null) {
            throw new IllegalStateException("Runtime não encontrado: " + id);
        }

        return runtime;
    }

    public Path executable(String id) {
        return get(id).executablePath();
    }

    public Map<String, RuntimeInfo> all() {
        return runtimes;
    }
}