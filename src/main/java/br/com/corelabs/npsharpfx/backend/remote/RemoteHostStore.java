package br.com.corelabs.npsharpfx.backend.remote;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import br.com.corelabs.npsharpfx.backend.runtime.RuntimePaths;

public class RemoteHostStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private final Path file = RuntimePaths.appDataDir().resolve("remote-hosts.json");

    public List<RemoteHostConfig> load() {
        try {
            if (!Files.exists(file)) {
                return new ArrayList<>();
            }
            RemoteHostConfig[] hosts = GSON.fromJson(Files.readString(file), RemoteHostConfig[].class);
            return hosts == null ? new ArrayList<>() : new ArrayList<>(Arrays.asList(hosts));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    public void save(List<RemoteHostConfig> hosts) throws Exception {
        Files.createDirectories(file.getParent());
        Files.writeString(file, GSON.toJson(hosts == null ? List.of() : hosts));
    }
}
