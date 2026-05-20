package br.com.corelabs.npsharpfx.backend.remote;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
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

    public void connect(RemoteHostConfig config, String password) {
        try {
            disconnect();
            this.config = config;
            JSch jsch = new JSch();
            if ("key".equalsIgnoreCase(config.getAuthMethod()) && config.getPrivateKeyPath() != null && !config.getPrivateKeyPath().isBlank()) {
                jsch.addIdentity(config.getPrivateKeyPath());
            }
            session = jsch.getSession(config.getUsername(), config.getHost(), config.getPort());
            if (!"key".equalsIgnoreCase(config.getAuthMethod())) {
                session.setPassword(password == null ? "" : password);
            }
            Properties properties = new Properties();
            properties.put("StrictHostKeyChecking", "no");
            session.setConfig(properties);
            session.setTimeout(15000);
            session.connect(15000);
            sftp = (ChannelSftp) session.openChannel("sftp");
            sftp.connect(10000);
        } catch (Exception e) {
            disconnect();
            throw new IllegalStateException(friendly(e.getMessage()), e);
        }
    }

    public boolean isConnected() {
        return session != null && session.isConnected() && sftp != null && sftp.isConnected();
    }

    public void disconnect() {
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

    public List<WorkspaceEntry> list(String path) throws Exception {
        ensureConnected();
        @SuppressWarnings("unchecked")
        Vector<ChannelSftp.LsEntry> entries = sftp.ls(normalize(path));
        return entries.stream()
                .filter(e -> !".".equals(e.getFilename()) && !"..".equals(e.getFilename()))
                .map(e -> new WorkspaceEntry(join(path, e.getFilename()), e.getFilename(), e.getAttrs().isDir(), e.getAttrs().getSize()))
                .sorted(java.util.Comparator.comparing(WorkspaceEntry::directory).reversed().thenComparing(WorkspaceEntry::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    public String readText(String path) throws Exception {
        ensureConnected();
        try (var input = sftp.get(normalize(path))) {
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    public void writeText(String path, String content) throws Exception {
        ensureConnected();
        byte[] bytes = (content == null ? "" : content).getBytes(StandardCharsets.UTF_8);
        sftp.put(new java.io.ByteArrayInputStream(bytes), normalize(path));
    }

    public void mkdir(String path) throws Exception {
        ensureConnected();
        sftp.mkdir(normalize(path));
    }

    public void touch(String path) throws Exception {
        writeText(path, "");
    }

    public void rename(String from, String to) throws Exception {
        ensureConnected();
        sftp.rename(normalize(from), normalize(to));
    }

    public void delete(String path) throws Exception {
        ensureConnected();
        String normalized = normalize(path);
        SftpATTRS attrs = sftp.stat(normalized);
        if (attrs.isDir()) {
            for (WorkspaceEntry entry : list(path)) {
                delete(entry.path());
            }
            sftp.rmdir(normalized);
        } else {
            sftp.rm(normalized);
        }
    }

    public String execute(String command) throws Exception {
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
            return err.isBlank() ? out : out + System.lineSeparator() + err;
        } finally {
            if (channel.isConnected()) {
                channel.disconnect();
            }
        }
    }

    private void ensureConnected() throws Exception {
        if (!isConnected()) {
            throw new IllegalStateException("Host remoto desconectado.");
        }
    }

    private String normalize(String path) {
        if (path == null || path.isBlank()) {
            return config == null ? "." : config.getDefaultPath();
        }
        return path;
    }

    private String join(String parent, String child) {
        String base = normalize(parent);
        return base.endsWith("/") ? base + child : base + "/" + child;
    }

    private String friendly(String message) {
        if (message == null) {
            return "Nao foi possivel conectar ao host remoto.";
        }
        String lower = message.toLowerCase();
        if (lower.contains("auth fail")) {
            return "Autenticacao recusada. Confira usuario, senha ou chave privada.";
        }
        if (lower.contains("timeout")) {
            return "Tempo esgotado ao conectar. Confira host, porta e rede.";
        }
        if (lower.contains("permission")) {
            return "Permissao negada no host remoto.";
        }
        return message;
    }

    public boolean exists(String path) {
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
