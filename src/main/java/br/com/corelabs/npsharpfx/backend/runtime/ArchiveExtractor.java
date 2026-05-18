package br.com.corelabs.npsharpfx.backend.runtime;

import java.nio.file.Path;

public class ArchiveExtractor {

    public void extract(Path archive, Path destination) throws Exception {

        String name = archive.getFileName().toString().toLowerCase();

        if (name.endsWith(".zip")) {
            extractZip(archive, destination);
            return;
        }

        throw new IllegalStateException("Formato não suportado: " + name);
    }

    private void extractZip(Path archive, Path destination) throws Exception {

        java.util.zip.ZipInputStream zis =
                new java.util.zip.ZipInputStream(
                        java.nio.file.Files.newInputStream(archive)
                );

        java.util.zip.ZipEntry entry;

        while ((entry = zis.getNextEntry()) != null) {

            Path output = destination.resolve(entry.getName());

            if (entry.isDirectory()) {
                java.nio.file.Files.createDirectories(output);
            } else {

                java.nio.file.Files.createDirectories(output.getParent());

                java.nio.file.Files.copy(
                        zis,
                        output,
                        java.nio.file.StandardCopyOption.REPLACE_EXISTING
                );
            }
        }

        zis.close();
    }
}