package br.com.corelabs.npsharpfx.backend.remote;

import java.util.concurrent.CompletableFuture;

public class RemoteTerminalService {
    private final RemoteHostService service;

    public RemoteTerminalService(RemoteHostService service) {
        this.service = service;
    }

    public CompletableFuture<String> executeAsync(String command) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return service.execute(command);
            } catch (Exception e) {
                return "[remote] " + (e.getMessage() == null ? "Falha ao executar comando." : e.getMessage());
            }
        });
    }
}
