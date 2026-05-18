package br.com.corelabs.npsharpfx.backend.runtime;

public record RuntimePackage(
        String id,
        String version,
        String url,
        String archiveName,
        String executableRelativePath
) {}