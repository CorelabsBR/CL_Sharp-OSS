package br.com.corelabs.npsharpfx.backend.filesystem;

public record WorkspaceEntry(String path, String name, boolean directory, long size) {
}
