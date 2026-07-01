/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.remote;

import java.util.concurrent.CompletableFuture;

public class RemoteTerminalService {
    private final RemoteHostService service;

    public RemoteTerminalService(RemoteHostService service) {
        this.service = service;
    }

    public String execute(String command) throws Exception {
        return service.execute(command);
    }

    public CompletableFuture<String> executeAsync(String command) {
        return CompletableFuture.supplyAsync(() -> {
            try {
                return execute(command);
            } catch (Exception e) {
                return "[remote] " + (e.getMessage() == null ? "Falha ao executar comando." : e.getMessage());
            }
        });
    }
}
