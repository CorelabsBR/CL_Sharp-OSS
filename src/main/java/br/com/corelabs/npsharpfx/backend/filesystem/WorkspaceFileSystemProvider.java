/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.filesystem;

import java.util.List;

public interface WorkspaceFileSystemProvider {
    String id();

    boolean isConnected();

    List<WorkspaceEntry> list(String path) throws Exception;

    String readText(String path) throws Exception;

    void writeText(String path, String content) throws Exception;

    void createFile(String path) throws Exception;

    void createDirectory(String path) throws Exception;

    void rename(String oldPath, String newPath) throws Exception;

    void delete(String path) throws Exception;
}
