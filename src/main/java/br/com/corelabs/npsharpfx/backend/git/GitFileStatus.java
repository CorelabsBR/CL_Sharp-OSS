package br.com.corelabs.npsharpfx.backend.git;

public record GitFileStatus(
        String repositoryName,
        String path,
        String oldPath,
        GitStatusKind kind,
        boolean staged,
        boolean conflicted,
        boolean ignored) {
}
