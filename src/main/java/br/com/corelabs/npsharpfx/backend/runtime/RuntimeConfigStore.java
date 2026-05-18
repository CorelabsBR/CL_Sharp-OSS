package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Files;
import java.nio.file.Path;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

public class RuntimeConfigStore {

    private final Path configFile;
    private final Gson gson;

    public RuntimeConfigStore(Path root) {

        this.configFile = root.resolve("config/runtimes.json");

        this.gson = new GsonBuilder()
                .setPrettyPrinting()
                .create();
    }

    public boolean exists() {
        return Files.exists(configFile);
    }

    public void save(RuntimeRegistry registry) throws Exception {

        Files.createDirectories(configFile.getParent());

        String json = gson.toJson(registry.all());

        Files.writeString(configFile, json);
    }

    public RuntimeRegistry load() throws Exception {

        String json = Files.readString(configFile);

        java.lang.reflect.Type type =
                new com.google.gson.reflect.TypeToken<
                        java.util.Map<String, RuntimeInfo>
                        >() {}.getType();

        java.util.Map<String, RuntimeInfo> map =
                gson.fromJson(json, type);

        RuntimeRegistry registry = new RuntimeRegistry();

        map.values().forEach(registry::register);

        return registry;
    }
}