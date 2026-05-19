package br.com.corelabs.npsharpfx.backend.runtime;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Comparator;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class RuntimeInstaller {

    public interface Listener {
        void onLog(String message);
        void onProgress(LanguageRuntime language, double progress);
    }

    private final Path runtimesDir;
    private final RuntimeRegistry registry;
    private final RuntimeManifest manifest;

    public RuntimeInstaller(Path appDataDir, RuntimeRegistry registry) {
        this.runtimesDir = appDataDir.resolve("runtimes");
        this.registry = registry;
        this.manifest = new RuntimeManifest();
    }

    public void installAllCommon(Listener listener) throws Exception {
        registerInternalPortugol(listener);

        for (LanguageRuntime language : LanguageRuntime.values()) {
            if (language == LanguageRuntime.PORTUGOL) {
                continue;
            }

            try {
                install(language, listener);
            } catch (UnavailableRuntimePackageException e) {
                listener.onLog("[RUNTIME] " + e.getMessage());
                listener.onProgress(language, 0.0);
            }
        }

        registry.save();
    }

    public void install(LanguageRuntime language, Listener listener) throws Exception {
        if (registry.isInstalled(language)) {
            listener.onLog("[RUNTIME] " + language.displayName() + " já instalado.");
            listener.onProgress(language, 1.0);
            return;
        }

        var def = manifest.find(language)
                .orElseThrow(() -> new IllegalStateException("Sem pacote para " + language.displayName()));

        if ("internal".equals(def.url())) {
            registerInternalPortugol(listener);
            return;
        }

        if (!hasDownloadUrl(def)) {
            throw new UnavailableRuntimePackageException(
                    "Pacote de " + language.displayName() + " ainda sem URL real no RuntimeManifest."
            );
        }

        listener.onLog("[RUNTIME] Instalando " + language.displayName());

        Files.createDirectories(runtimesDir);

        Path langRoot = runtimesDir.resolve(language.id());
        Path archive = runtimesDir.resolve(language.id() + "." + def.archiveType());

        deleteDirectory(langRoot);
        Files.createDirectories(langRoot);

        download(def.url(), archive, language, listener);

        if ("zip".equalsIgnoreCase(def.archiveType())) {
            unzip(archive, langRoot);
        } else {
            throw new UnsupportedOperationException("Tipo de pacote não suportado ainda: " + def.archiveType());
        }

        Path exe = langRoot.resolve(def.executableRelativePath()).normalize();
        Path debugger = def.debuggerRelativePath() == null
                ? null
                : langRoot.resolve(def.debuggerRelativePath()).normalize();

        makeExecutable(exe);

        if (debugger != null && Files.exists(debugger)) {
            makeExecutable(debugger);
        }

        registry.register(new InstalledRuntime(
                language,
                langRoot,
                exe,
                debugger,
                def.version()
        ));

        listener.onLog("[RUNTIME] Instalado: " + language.displayName());
        listener.onProgress(language, 1.0);
    }

    private void registerInternalPortugol(Listener listener) {
        Path internal = Paths.get("internal-portugol");

        registry.register(new InstalledRuntime(
                LanguageRuntime.PORTUGOL,
                internal,
                internal,
                internal,
                "npsharp"
        ));

        listener.onLog("[RUNTIME] Portugol usa runtime interno do NPSharp.");
        listener.onProgress(LanguageRuntime.PORTUGOL, 1.0);
    }

    private void download(
            String url,
            Path destination,
            LanguageRuntime language,
            Listener listener
    ) throws Exception {
        HttpClient client = HttpClient.newBuilder()
                .followRedirects(HttpClient.Redirect.ALWAYS)
                .build();

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(url))
                .GET()
                .build();

        HttpResponse<InputStream> response = client.send(request, HttpResponse.BodyHandlers.ofInputStream());

        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Falha ao baixar " + url + ". HTTP " + response.statusCode());
        }

        long total = response.headers()
                .firstValueAsLong("Content-Length")
                .orElse(-1);

        try (InputStream in = response.body();
             OutputStream out = Files.newOutputStream(destination)) {

            byte[] buffer = new byte[1024 * 128];
            long readTotal = 0;
            int read;

            while ((read = in.read(buffer)) >= 0) {
                out.write(buffer, 0, read);
                readTotal += read;

                if (total > 0) {
                    listener.onProgress(language, Math.min(0.95, readTotal / (double) total));
                }
            }
        }
    }

    private void unzip(Path zipFile, Path targetDir) throws IOException {
        try (ZipInputStream zis = new ZipInputStream(Files.newInputStream(zipFile))) {
            ZipEntry entry;

            while ((entry = zis.getNextEntry()) != null) {
                Path output = targetDir.resolve(entry.getName()).normalize();

                if (!output.startsWith(targetDir)) {
                    throw new IOException("Entrada ZIP inválida: " + entry.getName());
                }

                if (entry.isDirectory()) {
                    Files.createDirectories(output);
                } else {
                    Files.createDirectories(output.getParent());

                    try (OutputStream out = Files.newOutputStream(output)) {
                        zis.transferTo(out);
                    }
                }
            }
        }
    }

    private void makeExecutable(Path path) {
        try {
            if (Files.exists(path)) {
                path.toFile().setExecutable(true, false);
            }
        } catch (Exception ignored) {
        }
    }

    private void deleteDirectory(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }

        try (var stream = Files.walk(path)) {
            stream.sorted(Comparator.reverseOrder())
                    .forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                        }
                    });
        }
    }

    private boolean hasDownloadUrl(RuntimeManifest.PackageDef def) {
        String url = def.url();
        return url != null
                && !url.isBlank()
                && !"internal".equals(url)
                && !url.startsWith("Colocar_a_merda_do_link");
    }

    private static final class UnavailableRuntimePackageException extends Exception {
        private UnavailableRuntimePackageException(String message) {
            super(message);
        }
    }
}
