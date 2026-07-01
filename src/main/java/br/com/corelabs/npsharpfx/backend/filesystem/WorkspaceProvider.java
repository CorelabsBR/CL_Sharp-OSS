/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.filesystem;

public class WorkspaceProvider {
    private WorkspaceFileSystemProvider activeProvider;
    private String rootLabel = "local";

    public WorkspaceFileSystemProvider activeProvider() {
        return activeProvider;
    }

    public void setActiveProvider(WorkspaceFileSystemProvider activeProvider, String rootLabel) {
        this.activeProvider = activeProvider;
        this.rootLabel = rootLabel == null || rootLabel.isBlank() ? "workspace" : rootLabel;
    }

    public boolean isRemote() {
        return activeProvider != null && !"local".equals(activeProvider.id());
    }

    public String rootLabel() {
        return rootLabel;
    }
}
