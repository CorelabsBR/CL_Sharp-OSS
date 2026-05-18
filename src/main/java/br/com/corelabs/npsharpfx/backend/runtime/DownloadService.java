package br.com.corelabs.npsharpfx.backend.runtime;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;

public class DownloadService {

    public Path download(String url, Path target) throws Exception {

        Files.createDirectories(target.getParent());

        try (InputStream in = URI.create(url).toURL().openStream()) {
            Files.copy(in, target);
        }

        return target;
    }
}