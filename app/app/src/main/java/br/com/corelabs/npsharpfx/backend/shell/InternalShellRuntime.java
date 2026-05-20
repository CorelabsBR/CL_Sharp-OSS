package br.com.corelabs.npsharpfx.backend.shell;

import android.content.Context;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Locale;

final class InternalShellRuntime {
    private final Context context;

    InternalShellRuntime(Context context) {
        this.context = context.getApplicationContext();
    }

    ShellResult execute(String script, ShellOutputListener listener, String runtimeName, String runtimePath) {
        long start = System.currentTimeMillis();
        StringBuilder stdout = new StringBuilder();
        StringBuilder stderr = new StringBuilder();
        int exit = 0;
        for (String rawLine : splitCommands(script)) {
            String line = rawLine.trim();
            if (line.isEmpty()) {
                continue;
            }
            int code = executeLine(line, stdout, stderr, listener);
            if (code != 0) {
                exit = code;
                break;
            }
        }
        ShellResult result = new ShellResult(exit, stdout.toString(), stderr.toString(), System.currentTimeMillis() - start, runtimeName, runtimePath);
        if (listener != null) {
            listener.onExit(result);
        }
        return result;
    }

    private int executeLine(String line, StringBuilder stdout, StringBuilder stderr, ShellOutputListener listener) {
        List<String> args = tokenize(line);
        if (args.isEmpty()) {
            return 0;
        }
        String command = args.get(0);
        try {
            switch (command) {
                case "true":
                    return 0;
                case "false":
                    return 1;
                case "pwd":
                    out(context.getFilesDir().getAbsolutePath(), stdout, listener);
                    return 0;
                case "echo":
                    out(String.join(" ", args.subList(1, args.size())), stdout, listener);
                    return 0;
                case "date":
                    out(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.ROOT).format(new Date()), stdout, listener);
                    return 0;
                case "uname":
                    out("Android " + android.os.Build.SUPPORTED_ABIS[0], stdout, listener);
                    return 0;
                case "whoami":
                    out(context.getPackageName(), stdout, listener);
                    return 0;
                case "ls":
                    return ls(args, stdout, stderr, listener);
                case "cat":
                    return cat(args, stdout, stderr, listener);
                default:
                    err("internal-shell: comando nao suportado sem runtime exec(): " + command, stderr, listener);
                    return 127;
            }
        } catch (Exception e) {
            err("internal-shell: " + stackLine(e), stderr, listener);
            return 1;
        }
    }

    private int ls(List<String> args, StringBuilder stdout, StringBuilder stderr, ShellOutputListener listener) {
        File dir = args.size() > 1 ? safeFile(args.get(1)) : context.getFilesDir();
        if (dir == null || !dir.exists()) {
            err("ls: caminho inexistente", stderr, listener);
            return 2;
        }
        if (dir.isFile()) {
            out(dir.getName(), stdout, listener);
            return 0;
        }
        File[] files = dir.listFiles();
        if (files == null) {
            return 0;
        }
        for (File file : files) {
            out((file.isDirectory() ? "[dir] " : "      ") + file.getName(), stdout, listener);
        }
        return 0;
    }

    private int cat(List<String> args, StringBuilder stdout, StringBuilder stderr, ShellOutputListener listener) throws Exception {
        if (args.size() < 2) {
            err("cat: informe um arquivo", stderr, listener);
            return 2;
        }
        File file = safeFile(args.get(1));
        if (file == null || !file.isFile()) {
            err("cat: arquivo inexistente", stderr, listener);
            return 2;
        }
        out(new String(Files.readAllBytes(file.toPath()), StandardCharsets.UTF_8), stdout, listener);
        return 0;
    }

    private File safeFile(String raw) {
        if (raw == null || raw.contains("\u0000")) {
            return null;
        }
        File base = context.getFilesDir();
        File file = raw.startsWith("/") ? new File(raw) : new File(base, raw);
        try {
            String canonical = file.getCanonicalPath();
            String allowed = base.getCanonicalPath();
            if (!canonical.startsWith(allowed)) {
                return null;
            }
            return file;
        } catch (Exception e) {
            return null;
        }
    }

    private List<String> splitCommands(String script) {
        String normalized = script == null ? "" : script.replace("&&", "\n").replace(";", "\n");
        return List.of(normalized.split("\\R"));
    }

    private List<String> tokenize(String line) {
        List<String> tokens = new ArrayList<>();
        StringBuilder current = new StringBuilder();
        boolean single = false;
        boolean dbl = false;
        for (int i = 0; i < line.length(); i++) {
            char ch = line.charAt(i);
            if (ch == '\'' && !dbl) {
                single = !single;
            } else if (ch == '"' && !single) {
                dbl = !dbl;
            } else if (Character.isWhitespace(ch) && !single && !dbl) {
                if (current.length() > 0) {
                    tokens.add(current.toString());
                    current.setLength(0);
                }
            } else {
                current.append(ch);
            }
        }
        if (current.length() > 0) {
            tokens.add(current.toString());
        }
        return tokens;
    }

    private void out(String text, StringBuilder stdout, ShellOutputListener listener) {
        String value = (text == null ? "" : text) + (text != null && text.endsWith("\n") ? "" : "\n");
        stdout.append(value);
        if (listener != null) listener.onStdout(value);
    }

    private void err(String text, StringBuilder stderr, ShellOutputListener listener) {
        String value = (text == null ? "" : text) + "\n";
        stderr.append(value);
        if (listener != null) listener.onStderr(value);
    }

    private String stackLine(Throwable e) {
        return e.getClass().getSimpleName() + ": " + (e.getMessage() == null ? "" : e.getMessage());
    }
}
