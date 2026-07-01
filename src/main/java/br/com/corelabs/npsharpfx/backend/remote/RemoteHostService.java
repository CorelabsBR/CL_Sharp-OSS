/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.remote;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Properties;
import java.util.Vector;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import com.jcraft.jsch.ChannelExec;
import com.jcraft.jsch.ChannelSftp;
import com.jcraft.jsch.JSch;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import com.jcraft.jsch.SftpATTRS;
import com.jcraft.jsch.SftpException;

import br.com.corelabs.npsharpfx.backend.filesystem.WorkspaceEntry;

public class RemoteHostService {

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "npsharp-remote");
        thread.setDaemon(true);
        return thread;
    });

    private Session session;
    private ChannelSftp sftp;
    private RemoteHostConfig config;

    public CompletableFuture<Void> connectAsync(RemoteHostConfig config, String password) {
        return CompletableFuture.runAsync(() -> connect(config, password), executor);
    }

    public synchronized void connect(RemoteHostConfig config, String password) {
        try {
            validateConfig(config);
            disconnect();
            this.config = config;
            JSch jsch = new JSch();
            if ("key".equalsIgnoreCase(config.getAuthMethod()) && config.getPrivateKeyPath() != null && !config.getPrivateKeyPath().isBlank()) {
                jsch.addIdentity(config.getPrivateKeyPath());
            }
            Path knownHosts = Path.of(System.getProperty("user.home"), ".ssh", "known_hosts");
            if (Files.isRegularFile(knownHosts)) {
                jsch.setKnownHosts(knownHosts.toString());
            }
            session = jsch.getSession(config.getUsername(), config.getHost(), config.getPort());
            if (!"key".equalsIgnoreCase(config.getAuthMethod())) {
                session.setPassword(password == null ? "" : password);
            }
            Properties properties = new Properties();
            properties.put("StrictHostKeyChecking", "no");
            properties.put("PreferredAuthentications", "publickey,password,keyboard-interactive");
            session.setConfig(properties);
            session.setTimeout(15000);
            session.connect(15000);
            sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect(10000);
        } catch (Exception e) {
            disconnect();
            throw remoteFailure("conectar", e);
        }
    }

    public synchronized boolean isConnected() {
        return session != null && session.isConnected() && sftp != null && sftp.isConnected();
    }

    public synchronized void disconnect() {
        try {
            if (sftp != null) {
                sftp.disconnect();
            }
        } catch (Exception ignored) {
        }
        try {
            if (session != null) {
                session.disconnect();
            }
        } catch (Exception ignored) {
        }
        sftp = null;
        session = null;
    }

    public RemoteHostConfig config() {
        return config;
    }

    public synchronized List<WorkspaceEntry> list(String path) throws Exception {
        try {
            ensureConnected();
            String normalizedPath = normalize(path);
            @SuppressWarnings("unchecked")
            Vector<ChannelSftp.LsEntry> entries = sftp.ls(normalizedPath);
            return entries.stream()
                    .filter(e -> !".".equals(e.getFilename()) && !"..".equals(e.getFilename()))
                    .map(e -> new WorkspaceEntry(join(normalizedPath, e.getFilename()), e.getFilename(), e.getAttrs().isDir(), e.getAttrs().getSize()))
                    .sorted(java.util.Comparator.comparing(WorkspaceEntry::directory).reversed().thenComparing(WorkspaceEntry::name, String.CASE_INSENSITIVE_ORDER))
                    .toList();
        } catch (Exception e) {
            throw remoteFailure("listar", e);
        }
    }

    public synchronized String readText(String path) throws Exception {
        try {
            ensureConnected();
            try (var input = sftp.get(normalize(path))) {
                return new String(input.readAllBytes(), StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            throw remoteFailure("abrir", e);
        }
    }

    public synchronized void writeText(String path, String content) throws Exception {
        try {
            ensureConnected();
            byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
            sftp.put(new java.io.ByteArrayInputStream(bytes), normalize(path));
        } catch (Exception e) {
            throw remoteFailure("salvar", e);
        }
    }

    public synchronized void mkdir(String path) throws Exception {
        try {
            ensureConnected();
            sftp.mkdir(normalize(path));
        } catch (Exception e) {
            throw remoteFailure("criar pasta", e);
        }
    }

    public synchronized void touch(String path) throws Exception {
        writeText(path, "");
    }

    public synchronized void rename(String from, String to) throws Exception {
        try {
            ensureConnected();
            sftp.rename(normalize(from), normalize(to));
        } catch (Exception e) {
            throw remoteFailure("renomear", e);
        }
    }

    public synchronized void delete(String path) throws Exception {
        try {
            ensureConnected();
            String normalized = normalize(path);
            SftpATTRS attrs = sftp.stat(normalized);
            if (attrs.isDir()) {
                for (WorkspaceEntry entry : list(normalized)) {
                    delete(entry.path());
                }
                sftp.rmdir(normalized);
            } else {
                sftp.rm(normalized);
            }
        } catch (Exception e) {
            throw remoteFailure("excluir", e);
        }
    }

    public synchronized String execute(String command) throws Exception {
        if (command == null || command.isBlank()) {
            throw new IllegalArgumentException("Informe um comando remoto.");
        }
        try {
            ensureConnected();
            ChannelExec channel = (ChannelExec) session.openChannel("exec");
            channel.setCommand(command);
            channel.setInputStream(null);
            ByteArrayOutputStream error = new ByteArrayOutputStream();
            channel.setErrStream(error);
            try (InputStream input = channel.getInputStream()) {
                channel.connect(10000);
                ByteArrayOutputStream output = new ByteArrayOutputStream();
                byte[] buffer = new byte[8192];
                while (!channel.isClosed()) {
                    while (input.available() > 0) {
                        int read = input.read(buffer, 0, Math.min(buffer.length, input.available()));
                        if (read < 0) {
                            break;
                        }
                        output.write(buffer, 0, read);
                    }
                    Thread.sleep(25);
                }
                while (input.available() > 0) {
                    int read = input.read(buffer, 0, Math.min(buffer.length, input.available()));
                    if (read < 0) {
                        break;
                    }
                    output.write(buffer, 0, read);
                }
                String out = output.toString(StandardCharsets.UTF_8);
                String err = error.toString(StandardCharsets.UTF_8);
                String result = err.isBlank() ? out : out + System.lineSeparator() + err;
                int exitStatus = channel.getExitStatus();
                if (exitStatus != 0) {
                    result = result + (result.isBlank() ? "" : System.lineSeparator()) + "[remote] exit code " + exitStatus;
                }
                return result;
            } finally {
                if (channel.isConnected()) {
                    channel.disconnect();
                }
            }
        } catch (Exception e) {
            throw remoteFailure("executar comando", e);
        }
    }

    private void ensureConnected() throws Exception {
        if (!isConnected()) {
            throw new IllegalStateException("Host remoto desconectado.");
        }
    }

    private void validateConfig(RemoteHostConfig config) {
        if (config == null) {
            throw new IllegalArgumentException("Configuracao de host remoto invalida.");
        }
        if (config.getHost() == null || config.getHost().isBlank()) {
            throw new IllegalArgumentException("Informe o host remoto.");
        }
        if (config.getUsername() == null || config.getUsername().isBlank()) {
            throw new IllegalArgumentException("Informe o usuario remoto.");
        }
        if (config.getPort() <= 0 || config.getPort() > 65535) {
            throw new IllegalArgumentException("Porta SSH invalida.");
        }
        if ("key".equalsIgnoreCase(config.getAuthMethod())
                && (config.getPrivateKeyPath() == null || config.getPrivateKeyPath().isBlank())) {
            throw new IllegalArgumentException("Informe o caminho da chave privada.");
        }
    }

    private String normalize(String path) {
        if (path == null || path.isBlank()) {
            if (config == null || config.getDefaultPath() == null || config.getDefaultPath().isBlank()) {
                return ".";
            }
            return config.getDefaultPath();
        }
        return path.trim();
    }

    private String join(String parent, String child) {
        String base = normalize(parent);
        return base.endsWith("/") ? base + child : base + "/" + child;
    }

    private IllegalStateException remoteFailure(String action, Throwable error) {
        return new IllegalStateException("Falha ao " + action + " remoto: " + friendly(error), error);
    }

    private String friendly(Throwable error) {
        Throwable cause = error;
        while (cause.getCause() != null && cause.getCause() != cause) {
            cause = cause.getCause();
        }
        if (cause instanceof SftpException sftpError) {
            return friendlySftp(sftpError);
        }
        if (cause instanceof JSchException jschError) {
            return friendlyJsch(jschError.getMessage());
        }
        String message = cause.getMessage();
        if (message == null || message.isBlank()) {
            return "Operacao remota nao concluida.";
        }
        String lower = message.toLowerCase();
        if (lower.contains("permission")) {
            return "Permissao negada no host remoto.";
        }
        if (lower.contains("no such file") || lower.contains("not found")) {
            return "Caminho remoto invalido ou inexistente.";
        }
        return message;
    }

    private String friendlyJsch(String message) {
        if (message == null || message.isBlank()) {
            return "Nao foi possivel conectar ao host remoto.";
        }
        String lower = message.toLowerCase();
        if (lower.contains("auth fail") || lower.contains("auth cancel") || lower.contains("authentication")) {
            return "Autenticacao recusada. Confira usuario, senha ou chave privada.";
        }
        if (lower.contains("timeout") || lower.contains("timed out")) {
            return "Tempo esgotado ao conectar. Confira host, porta e rede.";
        }
        if (lower.contains("connection refused")) {
            return "Conexao recusada. Confira host, porta e servico SSH.";
        }
        if (lower.contains("unknownhost") || lower.contains("unknown host")) {
            return "Host remoto nao encontrado.";
        }
        if (lower.contains("algorithm negotiation fail")) {
            return "Falha na negociacao SSH. O servidor exige algoritmos nao suportados por esta biblioteca.";
        }
        return message;
    }

    private String friendlySftp(SftpException error) {
        return switch (error.id) {
            case ChannelSftp.SSH_FX_NO_SUCH_FILE -> "Caminho remoto invalido ou inexistente.";
            case ChannelSftp.SSH_FX_PERMISSION_DENIED -> "Permissao negada no caminho remoto.";
            case ChannelSftp.SSH_FX_FAILURE -> {
                String message = error.getMessage();
                yield message == null || message.isBlank() ? "Falha SFTP no host remoto." : message;
            }
            default -> {
                String message = error.getMessage();
                yield message == null || message.isBlank() ? "Erro SFTP no host remoto." : message;
            }
        };
    }

    public synchronized boolean exists(String path) {
        try {
            ensureConnected();
            sftp.stat(normalize(path));
            return true;
        } catch (SftpException e) {
            return false;
        } catch (Exception e) {
            return false;
        }
    }
}
