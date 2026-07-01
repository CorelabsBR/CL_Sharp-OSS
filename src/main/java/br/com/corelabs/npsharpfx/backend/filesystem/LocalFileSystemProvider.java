/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.filesystem;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

public class LocalFileSystemProvider implements WorkspaceFileSystemProvider {

    private final Path root;

    public LocalFileSystemProvider(Path root) {
        this.root = root.toAbsolutePath().normalize();
    }

    @Override
    public String id() {
        return "local";
    }

    @Override
    public boolean isConnected() {
        return Files.isDirectory(root);
    }

    @Override
    public List<WorkspaceEntry> list(String path) throws Exception {
        Path target = resolve(path);
        try (var stream = Files.list(target)) {
            return stream
                    .map(p -> new WorkspaceEntry(root.relativize(p).toString(), p.getFileName().toString(), Files.isDirectory(p), sizeOf(p)))
                    .sorted(Comparator.comparing(WorkspaceEntry::directory).reversed().thenComparing(WorkspaceEntry::name, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        }
    }

    @Override
    public String readText(String path) throws Exception {
        return Files.readString(resolve(path));
    }

    @Override
    public void writeText(String path, String content) throws Exception {
        Files.writeString(resolve(path), content == null ? "" : content);
    }

    @Override
    public void createFile(String path) throws Exception {
        Path target = resolve(path);
        Files.createDirectories(target.getParent());
        if (!Files.exists(target)) {
            Files.createFile(target);
        }
    }

    @Override
    public void createDirectory(String path) throws Exception {
        Files.createDirectories(resolve(path));
    }

    @Override
    public void rename(String oldPath, String newPath) throws Exception {
        Files.move(resolve(oldPath), resolve(newPath));
    }

    @Override
    public void delete(String path) throws Exception {
        Path target = resolve(path);
        if (Files.isDirectory(target)) {
            try (var stream = Files.walk(target)) {
                for (Path p : stream.sorted(Comparator.reverseOrder()).toList()) {
                    Files.deleteIfExists(p);
                }
            }
        } else {
            Files.deleteIfExists(target);
        }
    }

    private Path resolve(String path) {
        Path target = path == null || path.isBlank() ? root : root.resolve(path).normalize();
        if (!target.startsWith(root)) {
            throw new IllegalArgumentException("Caminho fora do workspace local.");
        }
        return target;
    }

    private long sizeOf(Path path) {
        try {
            return Files.size(path);
        } catch (Exception e) {
            return 0L;
        }
    }
}
