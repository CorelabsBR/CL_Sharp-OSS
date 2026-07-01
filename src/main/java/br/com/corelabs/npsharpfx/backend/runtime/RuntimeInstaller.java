/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
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
import java.util.Locale;
import java.util.Optional;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

public final class RuntimeInstaller {

    public interface Listener {
        void onLog(String message);
        void onProgress(LanguageRuntime language, double progress);
    }

    private final Path runtimesDir;
    private final Path shimDir;
    private final Path appDataDir;
    private final RuntimeRegistry registry;
    private final RuntimeManifest manifest;

    public RuntimeInstaller(Path appDataDir, RuntimeRegistry registry) {
        this.appDataDir = appDataDir;
        this.runtimesDir = RuntimePaths.runtimesDir(appDataDir);
        this.shimDir = RuntimePaths.toolBinDir(appDataDir);
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
            if (registerSystemRuntime(language, def, listener)) {
                registry.save();
                return;
            }

            throw new UnavailableRuntimePackageException(
                    language.displayName()
                            + " nao encontrado. Instale a ferramenta no sistema ou configure uma URL no RuntimeManifest."
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
        Path internal = RuntimePaths.toolBinDir(appDataDir).resolve("internal-portugol");

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

    private boolean registerSystemRuntime(
            LanguageRuntime language,
            RuntimeManifest.PackageDef def,
            Listener listener
    ) throws IOException {
        Optional<Path> executable = findFirstOnPath(language.executableCandidates());

        if (executable.isEmpty()) {
            return false;
        }

        Files.createDirectories(shimDir);

        Path shim = createShim(language, executable.get());
        Path debugger = resolveDebuggerFromPath(def.debuggerRelativePath());

        registry.register(new InstalledRuntime(
                language,
                executable.get().getParent(),
                shim,
                debugger,
                def.version()
        ));

        listener.onLog("[RUNTIME] " + language.displayName()
                + " registrado via ferramenta existente: " + executable.get());
        listener.onProgress(language, 1.0);
        return true;
    }

    private Optional<Path> findFirstOnPath(String[] commandNames) {
        for (String command : commandNames) {
            Optional<Path> found = findOnPath(command);

            if (found.isPresent()) {
                return found;
            }
        }

        return Optional.empty();
    }

    private Optional<Path> findOnPath(String command) {
        String pathValue = System.getenv("PATH");

        if (pathValue == null || pathValue.isBlank()) {
            return Optional.empty();
        }

        boolean windows = RuntimeTarget.detect().os() == RuntimeTarget.Os.WINDOWS;
        String[] extensions = windows
                ? new String[] { "", ".exe", ".cmd", ".bat" }
                : new String[] { "" };

        for (String dir : pathValue.split(java.io.File.pathSeparator)) {
            if (dir == null || dir.isBlank()) {
                continue;
            }

            for (String ext : extensions) {
                Path candidate = Paths.get(dir).resolve(command + ext).normalize();

                if (Files.isRegularFile(candidate) && Files.isExecutable(candidate)) {
                    return Optional.of(candidate.toAbsolutePath().normalize());
                }
            }
        }

        return Optional.empty();
    }

    private Path createShim(LanguageRuntime language, Path target) throws IOException {
        RuntimeTarget targetPlatform = RuntimeTarget.detect();

        if (targetPlatform.os() == RuntimeTarget.Os.WINDOWS) {
            Path shim = shimDir.resolve(language.id() + ".cmd");
            String script = "@echo off\r\n"
                    + "\"" + target.toAbsolutePath() + "\" %*\r\n";
            Files.writeString(shim, script);
            return shim;
        }

        Path shim = shimDir.resolve(language.id());
        String script = "#!/usr/bin/env sh\n"
                + "exec \"" + target.toAbsolutePath() + "\" \"$@\"\n";
        Files.writeString(shim, script);
        makeExecutable(shim);
        return shim;
    }

    private Path resolveDebuggerFromPath(String debuggerRelativePath) {
        if (debuggerRelativePath == null || debuggerRelativePath.isBlank()) {
            return null;
        }

        String debuggerName = Paths.get(debuggerRelativePath).getFileName().toString();

        if (debuggerName.isBlank()) {
            return null;
        }

        String command = debuggerName;
        int dot = command.toLowerCase(Locale.ROOT).lastIndexOf(".exe");
        if (dot > 0) {
            command = command.substring(0, dot);
        }

        return findOnPath(command).orElse(null);
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
                && !"internal".equals(url);
    }

    private static final class UnavailableRuntimePackageException extends Exception {
        private UnavailableRuntimePackageException(String message) {
            super(message);
        }
    }
}
