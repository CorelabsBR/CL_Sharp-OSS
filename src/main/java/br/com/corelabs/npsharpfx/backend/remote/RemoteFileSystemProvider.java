package br.com.corelabs.npsharpfx.backend.remote;

import java.util.List;

import br.com.corelabs.npsharpfx.backend.filesystem.WorkspaceEntry;
import br.com.corelabs.npsharpfx.backend.filesystem.WorkspaceFileSystemProvider;

public class RemoteFileSystemProvider implements WorkspaceFileSystemProvider {
    private final RemoteHostService service;

    public RemoteFileSystemProvider(RemoteHostService service) {
        this.service = service;
    }

    @Override
    public String id() {
        return "remote";
    }

    @Override
    public boolean isConnected() {
        return service.isConnected();
    }

    @Override
    public List<WorkspaceEntry> list(String path) throws Exception {
        return service.list(path);
    }

    @Override
    public String readText(String path) throws Exception {
        return service.readText(path);
    }

    @Override
    public void writeText(String path, String content) throws Exception {
        service.writeText(path, content);
    }

    @Override
    public void createFile(String path) throws Exception {
        service.touch(path);
    }

    @Override
    public void createDirectory(String path) throws Exception {
        service.mkdir(path);
    }

    @Override
    public void rename(String oldPath, String newPath) throws Exception {
        service.rename(oldPath, newPath);
    }

    @Override
    public void delete(String path) throws Exception {
        service.delete(path);
    }
}
