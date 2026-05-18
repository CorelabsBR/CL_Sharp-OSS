package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Path;

public record RuntimeInfo(
        String id,
        String version,
        Path executablePath
) {} 