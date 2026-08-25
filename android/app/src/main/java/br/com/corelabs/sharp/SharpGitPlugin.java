package br.com.corelabs.sharp;

import android.content.Context;
import android.os.Environment;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.diff.DiffFormatter;
import org.eclipse.jgit.dircache.DirCacheEntry;
import org.eclipse.jgit.lib.Constants;
import org.eclipse.jgit.lib.BranchTrackingStatus;
import org.eclipse.jgit.lib.ObjectId;
import org.eclipse.jgit.lib.ObjectLoader;
import org.eclipse.jgit.lib.Repository;
import org.eclipse.jgit.revwalk.RevCommit;
import org.eclipse.jgit.revwalk.RevWalk;
import org.eclipse.jgit.storage.file.FileRepositoryBuilder;
import org.eclipse.jgit.treewalk.TreeWalk;
import org.eclipse.jgit.treewalk.filter.PathFilter;
import org.eclipse.jgit.transport.CredentialsProvider;
import org.eclipse.jgit.transport.UsernamePasswordCredentialsProvider;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.nio.charset.StandardCharsets;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.TimeZone;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Native Git backend for workspaces stored in Sharp-OSS's Android Documents area. */
@CapacitorPlugin(name = "SharpGit")
public class SharpGitPlugin extends Plugin {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private volatile CredentialsProvider credentialsProvider;

    @PluginMethod public void status(PluginCall call) { background(call, () -> statusResult(call.getString("workspace", ""))); }
    @PluginMethod public void run(PluginCall call) { background(call, () -> runCommand(call)); }
    @PluginMethod public void diff(PluginCall call) { background(call, () -> diffResult(call)); }
    @PluginMethod public void content(PluginCall call) { background(call, () -> contentResult(call)); }
    @PluginMethod public void history(PluginCall call) { background(call, () -> historyResult(call)); }
    @PluginMethod public void credentials(PluginCall call) {
        String username = call.getString("username", "git").trim();
        String token = call.getString("token", "");
        if (token.isEmpty()) { call.reject("Token Git vazio."); return; }
        credentialsProvider = new UsernamePasswordCredentialsProvider(username.isEmpty() ? "git" : username, token);
        call.resolve();
    }
    @PluginMethod public void identity(PluginCall call) {
        background(call, () -> {
            String name = call.getString("name", "").trim();
            String email = call.getString("email", "").trim();
            if (name.isEmpty() || email.isEmpty()) return operation(false, "Nome e e-mail Git são obrigatórios.");
            try (Git git = Git.open(resolve(call.getString("repo", ""), false))) {
                git.getRepository().getConfig().setString("user", null, "name", name);
                git.getRepository().getConfig().setString("user", null, "email", email);
                git.getRepository().getConfig().save();
            }
            return operation(true, "Identidade Git salva neste repositório.");
        });
    }

    @Override protected void handleOnDestroy() { credentialsProvider = null; executor.shutdownNow(); }

    private void background(PluginCall call, Work work) {
        executor.execute(() -> {
            try { call.resolve(work.run()); }
            catch (Exception error) { call.reject(error.getMessage() == null ? "Falha ao executar Git no Android." : error.getMessage(), error); }
        });
    }

    private JSObject statusResult(String workspace) throws Exception {
        File root = resolve(workspace, false);
        JSArray repos = new JSArray();
        if (!root.isDirectory()) return object("repos", repos);
        Set<File> found = new LinkedHashSet<>();
        discover(root, root, 5, found);
        for (File directory : found) repos.put(repositoryStatus(directory));
        return object("repos", repos);
    }

    private void discover(File root, File directory, int depth, Set<File> found) {
        if (new File(directory, Constants.DOT_GIT).exists()) { found.add(directory); return; }
        if (depth == 0) return;
        File[] children = directory.listFiles(File::isDirectory);
        if (children == null) return;
        for (File child : children) {
            String name = child.getName();
            if (name.equals("node_modules") || name.equals("build") || name.equals("target") || name.startsWith(".")) continue;
            discover(root, child, depth - 1, found);
        }
    }

    private JSObject repositoryStatus(File directory) throws Exception {
        try (Git git = Git.open(directory)) {
            Repository repository = git.getRepository();
            Status status = git.status().call();
            JSArray files = new JSArray();
            addFiles(files, directory, status.getAdded(), "added", true, "A", " ");
            addFiles(files, directory, status.getChanged(), "modified", true, "M", " ");
            addFiles(files, directory, status.getRemoved(), "deleted", true, "D", " ");
            addFiles(files, directory, status.getModified(), "modified", false, " ", "M");
            addFiles(files, directory, status.getMissing(), "deleted", false, " ", "D");
            addFiles(files, directory, status.getUntracked(), "untracked", false, "?", "?");
            addFiles(files, directory, status.getIgnoredNotInIndex(), "ignored", false, "!", "!");
            addFiles(files, directory, status.getConflicting(), "conflicted", false, "U", "U");
            JSArray branches = new JSArray();
            git.branchList().call().forEach(ref -> branches.put(Repository.shortenRefName(ref.getName())));
            String branch;
            try { branch = repository.getBranch(); } catch (Exception ignored) { branch = "detached"; }
            int ahead = 0, behind = 0;
            BranchTrackingStatus tracking = BranchTrackingStatus.of(repository, branch);
            if (tracking != null) { ahead = tracking.getAheadCount(); behind = tracking.getBehindCount(); }
            JSObject result = new JSObject();
            result.put("repo", relative(directory)); result.put("name", directory.getName()); result.put("branch", branch);
            result.put("ahead", ahead); result.put("behind", behind); result.put("files", files); result.put("branches", branches);
            result.put("clean", status.isClean());
            return result;
        }
    }

    private void addFiles(JSArray output, File repo, Set<String> paths, String kind, boolean staged, String x, String y) {
        for (String path : paths) {
            JSObject file = new JSObject();
            file.put("repositoryName", repo.getName()); file.put("repo", relative(repo)); file.put("path", path);
            file.put("absolutePath", relative(new File(repo, path))); file.put("oldPath", ""); file.put("kind", kind);
            file.put("staged", staged); file.put("conflicted", kind.equals("conflicted")); file.put("ignored", kind.equals("ignored"));
            file.put("x", x); file.put("y", y); output.put(file);
        }
    }

    private JSObject runCommand(PluginCall call) throws Exception {
        String repoPath = call.getString("repo", "");
        List<String> args = strings(call.getArray("args"));
        if (args.isEmpty()) return operation(false, "Comando Git vazio.");
        String command = args.get(0);
        if (command.equals("clone")) {
            if (args.size() < 2) return operation(false, "Informe a URL do repositório.");
            File parent = resolve(repoPath, true);
            String url = args.get(1);
            String name = cloneName(url);
            File destination = new File(parent, name);
            if (destination.exists()) return operation(false, "A pasta de destino já existe: " + name + ".");
            org.eclipse.jgit.api.CloneCommand clone = Git.cloneRepository().setURI(url).setDirectory(destination);
            if (credentialsProvider != null) clone.setCredentialsProvider(credentialsProvider);
            try (Git ignored = clone.call()) {}
            catch (Exception error) { deleteRecursively(destination); throw error; }
            return operation(true, "Repositório clonado em " + name + ".");
        }
        File directory = resolve(repoPath, true);
        if (command.equals("init")) { try (Git ignored = Git.init().setDirectory(directory).call()) {} return operation(true, "Repositório Git inicializado."); }
        try (Git git = Git.open(directory)) {
            switch (command) {
                case "add": git.add().addFilepattern(args.contains("-A") ? "." : pathArg(args)).call(); return operation(true, "Alterações adicionadas ao stage.");
                case "commit": {
                    String message = valueAfter(args, "-m");
                    if (message.isEmpty()) return operation(false, "Informe uma mensagem de commit.");
                    String authorName = git.getRepository().getConfig().getString("user", null, "name");
                    String authorEmail = git.getRepository().getConfig().getString("user", null, "email");
                    if (authorName == null || authorName.trim().isEmpty() || authorEmail == null || authorEmail.trim().isEmpty()) {
                        return operation(false, "GIT_IDENTITY_REQUIRED");
                    }
                    RevCommit commit = git.commit().setMessage(message).setAllowEmpty(args.contains("--allow-empty")).setAmend(args.contains("--amend")).call();
                    return operation(true, "Commit " + commit.abbreviate(7).name() + " criado.");
                }
                case "pull": {
                    org.eclipse.jgit.api.PullCommand pull = git.pull();
                    if (credentialsProvider != null) pull.setCredentialsProvider(credentialsProvider);
                    return operation(true, pull.call().toString());
                }
                case "push": {
                    org.eclipse.jgit.api.PushCommand push = git.push();
                    if (credentialsProvider != null) push.setCredentialsProvider(credentialsProvider);
                    push.call(); return operation(true, "Push concluído.");
                }
                case "fetch": {
                    org.eclipse.jgit.api.FetchCommand fetch = git.fetch();
                    if (credentialsProvider != null) fetch.setCredentialsProvider(credentialsProvider);
                    fetch.call(); return operation(true, "Fetch concluído.");
                }
                case "checkout": {
                    String branch = args.get(args.size() - 1);
                    git.checkout().setCreateBranch(args.contains("-b")).setName(branch).call();
                    return operation(true, "Branch " + branch + " selecionada.");
                }
                case "branch": {
                    if (args.contains("--show-current")) return operation(true, git.getRepository().getBranch());
                    if (args.stream().anyMatch(arg -> arg.startsWith("--format="))) {
                        StringBuilder names = new StringBuilder();
                        git.branchList().call().forEach(ref -> names.append(Repository.shortenRefName(ref.getName())).append('\n'));
                        return operation(true, names.toString().trim());
                    }
                    if (args.contains("-d")) git.branchDelete().setBranchNames(args.get(args.size() - 1)).call();
                    return operation(true, "Operação de branch concluída.");
                }
                case "restore": {
                    String path = pathArg(args);
                    if (args.contains("--staged")) git.reset().addPath(path).call();
                    else git.checkout().addPath(path).call();
                    return operation(true, "Arquivo restaurado.");
                }
                case "clean": git.clean().setPaths(Collections.singleton(pathArg(args))).call(); return operation(true, "Arquivo removido.");
                case "stash": {
                    if (args.size() > 1 && args.get(1).equals("pop")) git.stashApply().call(); else git.stashCreate().call();
                    return operation(true, "Operação stash concluída.");
                }
                case "config": {
                    int offset = args.contains("--local") ? 2 : 1;
                    if (args.size() <= offset + 1) return operation(false, "Informe a chave e o valor da configuração Git.");
                    git.getRepository().getConfig().setString("sharp", null, args.get(offset).replaceFirst("^sharp\\.", ""), args.get(offset + 1));
                    git.getRepository().getConfig().save();
                    return operation(true, "Configuração Git salva.");
                }
                case "diff": return operation(true, diffText(git, pathArg(args), args.contains("--cached")));
                case "log": {
                    Iterable<RevCommit> log = git.log().setMaxCount(1).call();
                    for (RevCommit commit : log) return operation(true, commit.getAuthorIdent().getName());
                    return operation(true, "");
                }
                default: return operation(false, "Comando Git não suportado no Android: " + command);
            }
        }
    }

    private JSObject diffResult(PluginCall call) throws Exception {
        try (Git git = Git.open(resolve(call.getString("repo", ""), false))) {
            return object("text", diffText(git, call.getString("path", ""), Boolean.TRUE.equals(call.getBoolean("staged", false))));
        }
    }

    private String diffText(Git git, String path, boolean staged) throws Exception {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        try (DiffFormatter formatter = new DiffFormatter(output)) {
            formatter.setRepository(git.getRepository());
            org.eclipse.jgit.api.DiffCommand command = git.diff().setCached(staged);
            if (path != null && !path.isEmpty() && !path.equals(".")) command.setPathFilter(PathFilter.create(path));
            List<DiffEntry> entries = command.call();
            for (DiffEntry entry : entries) formatter.format(entry);
        }
        return output.toString(StandardCharsets.UTF_8.name());
    }

    private JSObject contentResult(PluginCall call) throws Exception {
        File repoDir = resolve(call.getString("repo", ""), false);
        String path = call.getString("path", "");
        boolean staged = Boolean.TRUE.equals(call.getBoolean("staged", false));
        try (Git git = Git.open(repoDir)) {
            Repository repo = git.getRepository();
            String head = readTreeFile(repo, repo.resolve(Constants.HEAD), path);
            String index = readIndexFile(repo, path);
            String working = readFile(new File(repoDir, path));
            JSObject result = new JSObject();
            result.put("original", staged ? head : index); result.put("modified", staged ? index : working);
            result.put("originalLabel", staged ? "HEAD — " + path : "INDEX — " + path);
            result.put("modifiedLabel", staged ? "STAGED — " + path : "WORKING TREE — " + path);
            int dot = path.lastIndexOf('.'); result.put("language", dot < 0 ? "plaintext" : path.substring(dot + 1));
            return result;
        }
    }

    private String readTreeFile(Repository repo, ObjectId treeish, String path) throws Exception {
        if (treeish == null) return "";
        try (RevWalk revisions = new RevWalk(repo)) {
            RevCommit commit = revisions.parseCommit(treeish);
            try (TreeWalk walk = TreeWalk.forPath(repo, path, commit.getTree())) {
                if (walk == null) return "";
                ObjectLoader loader = repo.open(walk.getObjectId(0));
                return new String(loader.getBytes(), StandardCharsets.UTF_8);
            }
        }
    }

    private String readIndexFile(Repository repo, String path) throws Exception {
        DirCacheEntry entry = repo.readDirCache().getEntry(path);
        if (entry == null) return "";
        return new String(repo.open(entry.getObjectId()).getBytes(), StandardCharsets.UTF_8);
    }

    private JSObject historyResult(PluginCall call) throws Exception {
        JSArray commits = new JSArray();
        try (Git git = Git.open(resolve(call.getString("repo", ""), false))) {
            int count = 0;
            SimpleDateFormat format = new SimpleDateFormat("yyyy-MM-dd", Locale.ROOT); format.setTimeZone(TimeZone.getTimeZone("UTC"));
            for (RevCommit commit : git.log().setMaxCount(80).call()) {
                JSObject item = new JSObject(); item.put("hash", commit.name()); item.put("author", commit.getAuthorIdent().getName());
                item.put("date", format.format(new Date(commit.getCommitTime() * 1000L))); item.put("subject", commit.getShortMessage());
                item.put("body", commit.getFullMessage()); commits.put(item); if (++count >= 80) break;
            }
        }
        return object("commits", commits);
    }

    private File resolve(String requested, boolean create) throws Exception {
        if (requested.startsWith("android-tree-")) throw new IllegalArgumentException("Git exige um workspace Sharp-OSS no armazenamento do app; pastas externas escolhidas pelo Android ainda não expõem um caminho nativo.");
        File root = documentsRoot();
        String relative = requested.replace('\\', '/').replaceFirst("^/+", "");
        if (relative.contains("..")) throw new IllegalArgumentException("Caminho Git inválido.");
        File target = relative.isEmpty() ? root : new File(root, relative);
        String rootPath = root.getCanonicalPath(), targetPath = target.getCanonicalPath();
        if (!targetPath.equals(rootPath) && !targetPath.startsWith(rootPath + File.separator)) throw new IllegalArgumentException("Workspace fora do armazenamento permitido.");
        if (create && !target.exists() && !target.mkdirs()) throw new IllegalStateException("Não foi possível criar o workspace Git.");
        return target;
    }

    private String relative(File file) {
        try {
            File root = documentsRoot();
            String rootPath = root.getCanonicalPath(), path = file.getCanonicalPath();
            return path.equals(rootPath) ? "" : path.substring(rootPath.length() + 1).replace(File.separatorChar, '/');
        } catch (Exception ignored) { return file.getPath(); }
    }

    @SuppressWarnings("deprecation")
    private File documentsRoot() {
        File documents = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOCUMENTS);
        return documents != null ? documents : new File(getContext().getFilesDir(), "documents");
    }

    private String readFile(File file) throws Exception {
        if (!file.exists()) return "";
        try (FileInputStream input = new FileInputStream(file); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192]; int count;
            while ((count = input.read(buffer)) != -1) output.write(buffer, 0, count);
            return output.toString(StandardCharsets.UTF_8.name());
        }
    }
    private void deleteRecursively(File file) {
        if (!file.exists()) return;
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        if (!file.delete()) file.deleteOnExit();
    }
    private String pathArg(List<String> args) { for (int i = args.size() - 1; i > 0; i--) if (!args.get(i).startsWith("-")) return args.get(i); return "."; }
    private String valueAfter(List<String> args, String flag) { int i = args.indexOf(flag); return i >= 0 && i + 1 < args.size() ? args.get(i + 1) : ""; }
    private String cloneName(String url) { String clean = url.replaceAll("[?#].*$", "").replaceAll("/+$", "").replaceAll("\\.git$", ""); int slash = clean.lastIndexOf('/'); return slash < 0 ? "repository" : clean.substring(slash + 1); }
    private List<String> strings(JSArray array) throws Exception { List<String> result = new ArrayList<>(); if (array != null) for (int i = 0; i < array.length(); i++) result.add(array.getString(i)); return result; }
    private JSObject operation(boolean success, String output) { JSObject value = new JSObject(); value.put("success", success); value.put("output", output == null ? "" : output); return value; }
    private JSObject object(String key, Object value) { JSObject result = new JSObject(); result.put(key, value); return result; }
    private interface Work { JSObject run() throws Exception; }
}
