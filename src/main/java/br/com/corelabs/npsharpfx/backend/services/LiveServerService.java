/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.services;

import java.awt.Desktop;
import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Objects;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;
import java.util.function.Supplier;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import javafx.application.Platform;
import javafx.scene.control.Alert;
import javafx.stage.Stage;

public final class LiveServerService {

    private static final String HOST = "127.0.0.1";
    private static final int HTML_BASE_PORT = 5500;
    private static final int PHP_BASE_PORT = 8000;

    private final Stage stage;
    private final Supplier<java.io.File> workspaceSupplier;
    private final Consumer<String> statusUpdater;
    private final ExecutorService ioExecutor;

    private HttpServer htmlServer;
    private Path htmlRoot;
    private int htmlPort = -1;

    private Process phpProcess;
    private Path phpRoot;
    private int phpPort = -1;

    public LiveServerService(
            Stage stage,
            Supplier<java.io.File> workspaceSupplier,
            Consumer<String> statusUpdater
    ) {
        this.stage = stage;
        this.workspaceSupplier = Objects.requireNonNull(workspaceSupplier);
        this.statusUpdater = statusUpdater == null ? ignored -> {} : statusUpdater;
        this.ioExecutor = Executors.newSingleThreadExecutor(runnable -> {
            Thread thread = new Thread(runnable, "npsharp-live-server");
            thread.setDaemon(true);
            return thread;
        });
    }

    public void openWithLiveServer(java.io.File file) {
        if (file == null || !file.exists() || !file.isFile()) {
            showError("Live Server", "Arquivo inválido.");
            return;
        }

        java.io.File workspace = workspaceSupplier.get();
        if (workspace == null || !workspace.exists() || !workspace.isDirectory()) {
            showError("Live Server", "Abra uma pasta/workspace antes de usar o Live Server.");
            return;
        }

        String ext = extension(file.getName());

        if ("html".equals(ext) || "htm".equals(ext)) {
            openHtml(file.toPath(), workspace.toPath());
            return;
        }

        if ("php".equals(ext)) {
            openPhp(file.toPath(), workspace.toPath());
            return;
        }

        showError("Live Server", "Live Server suporta HTML e PHP neste momento.");
    }

    public void stopAll() {
        stopHtml();
        stopPhp();
        ioExecutor.shutdownNow();
    }

    public void stopHtml() {
        if (htmlServer != null) {
            htmlServer.stop(0);
            htmlServer = null;
            htmlRoot = null;
            htmlPort = -1;
            updateStatus("Live Server HTML parado");
        }
    }

    public void stopPhp() {
        if (phpProcess != null) {
            phpProcess.destroy();
            try {
                if (!phpProcess.waitFor(2, java.util.concurrent.TimeUnit.SECONDS)) {
                    phpProcess.destroyForcibly();
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                phpProcess.destroyForcibly();
            }
            phpProcess = null;
            phpRoot = null;
            phpPort = -1;
            updateStatus("Live Server PHP parado");
        }
    }

    private void openHtml(Path file, Path workspace) {
        ioExecutor.submit(() -> {
            try {
                Path root = workspace.toRealPath().normalize();
                Path target = file.toRealPath().normalize();

                if (!target.startsWith(root)) {
                    showError("Live Server", "Arquivo fora da pasta do projeto.");
                    return;
                }

                if (htmlServer == null || htmlRoot == null || !htmlRoot.equals(root)) {
                    stopHtml();
                    htmlPort = findFreePort(HTML_BASE_PORT);
                    htmlRoot = root;

                    htmlServer = HttpServer.create(new InetSocketAddress(HOST, htmlPort), 0);
                    htmlServer.createContext("/", exchange -> handleStaticRequest(exchange, htmlRoot));
                    htmlServer.setExecutor(Executors.newCachedThreadPool(runnable -> {
                        Thread thread = new Thread(runnable, "npsharp-live-html-client");
                        thread.setDaemon(true);
                        return thread;
                    }));
                    htmlServer.start();
                }

                String url = buildUrl(htmlPort, root, target);
                openBrowser(url);
                updateStatus("Live Server HTML: " + url);
            } catch (Exception e) {
                showError("Live Server HTML", firstLine(e.getMessage()));
            }
        });
    }

    private void openPhp(Path file, Path workspace) {
        ioExecutor.submit(() -> {
            try {
                Path root = workspace.toRealPath().normalize();
                Path target = file.toRealPath().normalize();

                if (!target.startsWith(root)) {
                    showError("Live Server", "Arquivo fora da pasta do projeto.");
                    return;
                }

                if (!isCommandAvailable("php")) {
                    showError("Live Server PHP", "PHP não encontrado no PATH. Instale PHP ou configure o caminho do executável.");
                    return;
                }

                if (phpProcess == null || !phpProcess.isAlive() || phpRoot == null || !phpRoot.equals(root)) {
                    stopPhp();

                    phpPort = findFreePort(PHP_BASE_PORT);
                    phpRoot = root;

                    ProcessBuilder builder = new ProcessBuilder(
                            "php",
                            "-S",
                            HOST + ":" + phpPort,
                            "-t",
                            root.toString()
                    );

                    builder.redirectErrorStream(true);
                    phpProcess = builder.start();

                    Process processRef = phpProcess;
                    ioExecutor.submit(() -> {
                        try (var reader = new java.io.BufferedReader(
                                new java.io.InputStreamReader(processRef.getInputStream(), StandardCharsets.UTF_8))) {
                            String line;
                            while ((line = reader.readLine()) != null) {
                                System.out.println("[php-live-server] " + line);
                            }
                        } catch (IOException ignored) {
                            // processo encerrado
                        }
                    });

                    Thread.sleep(350);
                }

                String url = buildUrl(phpPort, root, target);
                openBrowser(url);
                updateStatus("Live Server PHP: " + url);
            } catch (Exception e) {
                showError("Live Server PHP", firstLine(e.getMessage()));
            }
        });
    }

    private void handleStaticRequest(HttpExchange exchange, Path root) throws IOException {
        try {
            String rawPath = exchange.getRequestURI().getPath();
            String decodedPath = URLDecoder.decode(rawPath, StandardCharsets.UTF_8);
            if (decodedPath.startsWith("/")) {
                decodedPath = decodedPath.substring(1);
            }

            Path requested = root.resolve(decodedPath).normalize();

            if (!requested.startsWith(root)) {
                send(exchange, 403, "Forbidden", "text/plain; charset=utf-8");
                return;
            }

            if (Files.isDirectory(requested)) {
                Path index = requested.resolve("index.html");
                if (Files.exists(index) && Files.isRegularFile(index)) {
                    requested = index;
                }
            }

            if (!Files.exists(requested) || !Files.isRegularFile(requested)) {
                send(exchange, 404, "Not Found", "text/plain; charset=utf-8");
                return;
            }

            byte[] data = Files.readAllBytes(requested);
            exchange.getResponseHeaders().set("Content-Type", contentType(requested));
            exchange.sendResponseHeaders(200, data.length);

            try (OutputStream os = exchange.getResponseBody()) {
                os.write(data);
            }
        } catch (Exception e) {
            send(exchange, 500, "Internal Server Error", "text/plain; charset=utf-8");
        }
    }

    private void send(HttpExchange exchange, int code, String text, String contentType) throws IOException {
        byte[] data = text.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.sendResponseHeaders(code, data.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(data);
        }
    }

    private String buildUrl(int port, Path root, Path target) {
        String relative = root.relativize(target).toString().replace('\\', '/');
        return "http://" + HOST + ":" + port + "/" + relative;
    }
private void openBrowser(String url) throws Exception {
    if (isLinux()) {
        new ProcessBuilder("xdg-open", url).start();
        return;
    }

    if (Desktop.isDesktopSupported()
            && Desktop.getDesktop().isSupported(Desktop.Action.BROWSE)) {
        Desktop.getDesktop().browse(URI.create(url));
        return;
    }

    updateStatus("Abra no navegador: " + url);
}

private boolean isLinux() {
    String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
    return os.contains("linux");
}

    private int findFreePort(int start) throws IOException {
        for (int port = start; port < start + 200; port++) {
            try (java.net.ServerSocket socket = new java.net.ServerSocket()) {
                socket.setReuseAddress(false);
                socket.bind(new InetSocketAddress(HOST, port));
                return port;
            } catch (IOException ignored) {
                // tenta próxima porta
            }
        }

        throw new IOException("Nenhuma porta livre encontrada a partir de " + start);
    }

    private boolean isCommandAvailable(String command) {
        try {
            Process process = new ProcessBuilder(command, "-v")
                    .redirectErrorStream(true)
                    .start();

            boolean finished = process.waitFor(3, java.util.concurrent.TimeUnit.SECONDS);
            return finished && process.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    private String contentType(Path file) {
        String ext = extension(file.getFileName().toString());

        return switch (ext) {
            case "html", "htm" -> "text/html; charset=utf-8";
            case "css" -> "text/css; charset=utf-8";
            case "js", "mjs" -> "application/javascript; charset=utf-8";
            case "json" -> "application/json; charset=utf-8";
            case "svg" -> "image/svg+xml";
            case "png" -> "image/png";
            case "jpg", "jpeg" -> "image/jpeg";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            case "ico" -> "image/x-icon";
            case "txt" -> "text/plain; charset=utf-8";
            default -> "application/octet-stream";
        };
    }

    private String extension(String name) {
        int dot = name == null ? -1 : name.lastIndexOf('.');
        if (dot < 0 || dot == name.length() - 1) {
            return "";
        }
        return name.substring(dot + 1).toLowerCase(Locale.ROOT);
    }

    private void updateStatus(String message) {
        Platform.runLater(() -> statusUpdater.accept(message));
    }

    private void showError(String title, String message) {
        Platform.runLater(() -> {
            Alert alert = new Alert(Alert.AlertType.ERROR);
            alert.initOwner(stage);
            alert.setTitle(title);
            alert.setHeaderText(null);
            alert.setContentText(message == null || message.isBlank() ? "Erro desconhecido." : message);
            alert.showAndWait();
        });
    }

    private String firstLine(String message) {
        if (message == null || message.isBlank()) {
            return "Erro desconhecido.";
        }
        return message.lines().findFirst().orElse(message);
    }
}
