package br.com.corelabs.npsharpfx.backend.git;

import java.io.File;
import java.io.InputStream;
import java.nio.charset.Charset;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.function.Consumer;

public class GitService {

    private final ExecutorService executor = Executors.newCachedThreadPool(r -> {
        Thread thread = new Thread(r, "npsharp-git");
        thread.setDaemon(true);
        return thread;
    });
    private final String gitExecutable;
    private Consumer<String> logConsumer;

    public GitService(String gitExecutable) {
        this.gitExecutable = gitExecutable == null || gitExecutable.isBlank() ? "git" : gitExecutable;
    }

    public void setLogConsumer(Consumer<String> logConsumer) {
        this.logConsumer = logConsumer;
    }

    public CompletableFuture<List<GitRepositoryStatus>> statusAsync(File workspace) {
        return CompletableFuture.supplyAsync(() -> discoverRepositories(workspace).stream()
                .map(this::readStatus)
                .sorted(Comparator.comparing(GitRepositoryStatus::name, String.CASE_INSENSITIVE_ORDER))
                .toList(), executor);
    }

    public CompletableFuture<GitOperationResult> runAsync(File repo, String... args) {
        return CompletableFuture.supplyAsync(() -> run(repo, args), executor);
    }

    public CompletableFuture<String> diffAsync(File repo, GitFileStatus file, boolean staged) {
        return CompletableFuture.supplyAsync(() -> diff(repo, file, staged), executor);
    }

    public CompletableFuture<List<GitCommit>> historyAsync(File repo) {
        return CompletableFuture.supplyAsync(() -> history(repo), executor);
    }

    public List<File> discoverRepositories(File workspace) {
        if (workspace == null || !workspace.isDirectory()) {
            return List.of();
        }

        Set<File> repos = new LinkedHashSet<>();
        Path root = workspace.toPath().toAbsolutePath().normalize();
        if (Files.isDirectory(root.resolve(".git")) || Files.isRegularFile(root.resolve(".git"))) {
            repos.add(root.toFile());
        }

        try (var stream = Files.walk(root, 5)) {
            stream.filter(Files::isDirectory)
                    .filter(path -> !path.equals(root))
                    .filter(path -> {
                        String text = root.relativize(path).toString().replace("\\", "/");
                        return !text.contains("/.git")
                                && !text.startsWith(".git")
                                && !text.contains("/target/")
                                && !text.contains("/build/")
                                && !text.contains("/node_modules/");
                    })
                    .filter(path -> Files.exists(path.resolve(".git")))
                    .map(Path::toFile)
                    .forEach(repos::add);
        } catch (Exception e) {
            log("Falha ao procurar repositorios: " + e.getMessage());
        }

        return new ArrayList<>(repos);
    }

    public GitRepositoryStatus readStatus(File repo) {
        GitOperationResult branchResult = run(repo, "branch", "--show-current");
        GitOperationResult statusResult = run(repo, "status", "--porcelain=v1", "-b", "--ignored");
        GitOperationResult branchesResult = run(repo, "branch", "--format=%(refname:short)");

        String branch = branchResult.output() == null ? "" : branchResult.output().trim();
        if (branch.isBlank()) {
            branch = "detached";
        }

        int ahead = 0;
        int behind = 0;
        List<GitFileStatus> changes = new ArrayList<>();
        if (statusResult.success()) {
            for (String line : statusResult.output().lines().toList()) {
                if (line.startsWith("##")) {
                    int[] counts = parseAheadBehind(line);
                    ahead = counts[0];
                    behind = counts[1];
                } else if (!line.isBlank()) {
                    changes.add(parseStatusLine(repo.getName(), line));
                }
            }
        }

        List<String> branches = branchesResult.success()
                ? branchesResult.output().lines().map(String::trim).filter(s -> !s.isBlank()).toList()
                : List.of();

        return new GitRepositoryStatus(repo, repo.getName(), branch, ahead, behind, changes, branches);
    }

    public GitOperationResult stage(File repo, GitFileStatus file) {
        return run(repo, "add", "--", file.path());
    }

    public GitOperationResult unstage(File repo, GitFileStatus file) {
        return run(repo, "restore", "--staged", "--", file.path());
    }

    public GitOperationResult discard(File repo, GitFileStatus file) {
        if (file.kind() == GitStatusKind.UNTRACKED || file.kind() == GitStatusKind.IGNORED) {
            return run(repo, "clean", "-f", "--", file.path());
        }
        return run(repo, "restore", "--worktree", "--", file.path());
    }

    public GitOperationResult commit(File repo, String message, boolean allowEmpty) {
        if (message == null || message.isBlank()) {
            return new GitOperationResult(false, "Informe uma mensagem de commit.");
        }
        if (allowEmpty) {
            return run(repo, "commit", "--allow-empty", "-m", message.trim());
        }
        GitOperationResult staged = run(repo, "diff", "--cached", "--quiet");
        if (staged.success()) {
            return new GitOperationResult(false, "Nao ha alteracoes em stage para commit.");
        }
        return run(repo, "commit", "-m", message.trim());
    }

    public GitOperationResult checkout(File repo, String branch) {
        GitRepositoryStatus status = readStatus(repo);
        if (status.hasChanges()) {
            return new GitOperationResult(false, "Checkout bloqueado: ha alteracoes locais. Faça commit, stage/stash ou descarte antes.");
        }
        return run(repo, "checkout", branch);
    }

    public GitOperationResult createBranch(File repo, String branch) {
        if (branch == null || branch.isBlank()) {
            return new GitOperationResult(false, "Nome de branch vazio.");
        }
        return run(repo, "checkout", "-b", branch.trim());
    }

    public GitOperationResult acceptConflict(File repo, GitFileStatus file, ConflictResolution resolution) {
        if (resolution == ConflictResolution.MANUAL) {
            return new GitOperationResult(true, "Abra o diff manual e edite o arquivo para resolver.");
        }
        if (resolution == ConflictResolution.CURRENT) {
            GitOperationResult ours = run(repo, "checkout", "--ours", "--", file.path());
            if (!ours.success()) {
                return ours;
            }
            return run(repo, "add", "--", file.path());
        }
        if (resolution == ConflictResolution.INCOMING) {
            GitOperationResult theirs = run(repo, "checkout", "--theirs", "--", file.path());
            if (!theirs.success()) {
                return theirs;
            }
            return run(repo, "add", "--", file.path());
        }
        return acceptBoth(repo, file);
    }

    private GitOperationResult acceptBoth(File repo, GitFileStatus file) {
        try {
            Path path = repo.toPath().resolve(file.path()).normalize();
            List<String> lines = Files.readAllLines(path);
            List<String> merged = new ArrayList<>();
            boolean inMarker = false;
            for (String line : lines) {
                if (line.startsWith("<<<<<<<") || line.startsWith("=======") || line.startsWith(">>>>>>>")) {
                    inMarker = true;
                    continue;
                }
                merged.add(line);
                if (inMarker) {
                    inMarker = false;
                }
            }
            Files.write(path, merged);
            return run(repo, "add", "--", file.path());
        } catch (Exception e) {
            return new GitOperationResult(false, "Falha ao aceitar ambos: " + e.getMessage());
        }
    }

    public String diff(File repo, GitFileStatus file, boolean staged) {
        if (file.kind() == GitStatusKind.UNTRACKED && !staged) {
            try {
                return Files.readString(repo.toPath().resolve(file.path()));
            } catch (Exception e) {
                return "Arquivo novo nao pode ser lido: " + e.getMessage();
            }
        }
        List<String> args = new ArrayList<>();
        args.add("diff");
        if (staged) {
            args.add("--cached");
        }
        args.add("--");
        if (file.oldPath() != null && !file.oldPath().isBlank()) {
            args.add(file.oldPath());
        }
        args.add(file.path());
        return run(repo, args.toArray(String[]::new)).output();
    }

    public List<GitCommit> history(File repo) {
        GitOperationResult result = run(repo, "log", "--max-count=80", "--date=short", "--pretty=format:%H%x1f%an%x1f%ad%x1f%s%x1f%b%x1e");
        if (!result.success()) {
            return List.of();
        }
        List<GitCommit> commits = new ArrayList<>();
        for (String entry : result.output().split("\\u001e")) {
            String[] parts = entry.strip().split("\\u001f", 5);
            if (parts.length >= 4) {
                commits.add(new GitCommit(parts[0], parts[1], parts[2], parts[3], parts.length == 5 ? parts[4] : ""));
            }
        }
        return commits;
    }

    public GitOperationResult run(File repo, String... args) {
        List<String> command = new ArrayList<>();
        command.add(gitExecutable);
        command.addAll(List.of(args));
        log("$ " + String.join(" ", command));
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.directory(repo);
            builder.redirectErrorStream(true);
            Process process = builder.start();
            String output;
            try (InputStream input = process.getInputStream()) {
                output = new String(input.readAllBytes(), Charset.defaultCharset()).trim();
            }
            boolean finished = process.waitFor(Duration.ofSeconds(45).toMillis(), java.util.concurrent.TimeUnit.MILLISECONDS);
            if (!finished) {
                process.destroyForcibly();
                return new GitOperationResult(false, "Git demorou demais e foi interrompido.");
            }
            GitOperationResult result = new GitOperationResult(process.exitValue() == 0, output);
            if (!output.isBlank()) {
                log(output);
            }
            return result;
        } catch (Exception e) {
            return new GitOperationResult(false, e.getMessage() == null ? "Falha ao executar Git." : e.getMessage());
        }
    }

    private GitFileStatus parseStatusLine(String repoName, String line) {
        String xy = line.length() >= 2 ? line.substring(0, 2) : "??";
        String pathPart = line.length() > 3 ? line.substring(3).trim() : "";
        String oldPath = "";
        String path = pathPart;
        if (pathPart.contains(" -> ")) {
            String[] parts = pathPart.split(" -> ", 2);
            oldPath = parts[0];
            path = parts[1];
        }

        char x = xy.charAt(0);
        char y = xy.charAt(1);
        boolean ignored = x == '!' && y == '!';
        boolean untracked = x == '?' && y == '?';
        boolean conflicted = isConflict(x, y);
        boolean staged = x != ' ' && x != '?' && x != '!';
        GitStatusKind kind;
        if (conflicted) {
            kind = GitStatusKind.CONFLICTED;
        } else if (ignored) {
            kind = GitStatusKind.IGNORED;
        } else if (untracked) {
            kind = GitStatusKind.UNTRACKED;
        } else if (x == 'R' || y == 'R') {
            kind = GitStatusKind.RENAMED;
        } else if (x == 'A' || y == 'A') {
            kind = GitStatusKind.ADDED;
        } else if (x == 'D' || y == 'D') {
            kind = GitStatusKind.DELETED;
        } else {
            kind = GitStatusKind.MODIFIED;
        }
        return new GitFileStatus(repoName, path, oldPath, kind, staged, conflicted, ignored);
    }

    private boolean isConflict(char x, char y) {
        String xy = ("" + x + y).toUpperCase(Locale.ROOT);
        return xy.contains("U") || xy.equals("AA") || xy.equals("DD");
    }

    private int[] parseAheadBehind(String line) {
        int ahead = parseBracketNumber(line, "ahead ");
        int behind = parseBracketNumber(line, "behind ");
        return new int[] { ahead, behind };
    }

    private int parseBracketNumber(String line, String marker) {
        int idx = line.indexOf(marker);
        if (idx < 0) {
            return 0;
        }
        int start = idx + marker.length();
        int end = start;
        while (end < line.length() && Character.isDigit(line.charAt(end))) {
            end++;
        }
        try {
            return Integer.parseInt(line.substring(start, end));
        } catch (Exception e) {
            return 0;
        }
    }

    private void log(String text) {
        if (logConsumer != null && text != null && !text.isBlank()) {
            logConsumer.accept(text);
        }
    }

    public enum ConflictResolution {
        CURRENT,
        INCOMING,
        BOTH,
        MANUAL
    }
}
