package br.com.corelabs.sharp;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import org.eclipse.jgit.api.Git;
import org.eclipse.jgit.api.Status;
import org.eclipse.jgit.diff.DiffEntry;
import org.eclipse.jgit.revwalk.RevCommit;
import org.junit.Test;

import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.List;

/** Exercises the same JGit porcelain operations used by the Android bridge. */
public class SharpGitWorkflowTest {
    @Test
    public void mobileWorkflowClonesStagesCommitsPushesAndBranches() throws Exception {
        File root = Files.createTempDirectory("sharp-mobile-git-").toFile();
        File seedDirectory = new File(root, "seed");
        File remoteDirectory = new File(root, "remote.git");
        File mobileDirectory = new File(root, "mobile");
        File verifierDirectory = new File(root, "verifier");

        try {
            try (Git seed = Git.init().setDirectory(seedDirectory).call()) {
                configureIdentity(seed);
                Files.write(new File(seedDirectory, "README.md").toPath(), "initial\n".getBytes(StandardCharsets.UTF_8));
                seed.add().addFilepattern("README.md").call();
                seed.commit().setMessage("initial commit").call();
            }

            try (Git ignored = Git.cloneRepository().setURI(seedDirectory.toURI().toString()).setDirectory(remoteDirectory).setBare(true).call()) {}

            try (Git mobile = Git.cloneRepository().setURI(remoteDirectory.toURI().toString()).setDirectory(mobileDirectory).call()) {
                configureIdentity(mobile);
                Files.write(new File(mobileDirectory, "README.md").toPath(), "initial\nmobile change\n".getBytes(StandardCharsets.UTF_8));

                Status changed = mobile.status().call();
                assertTrue(changed.getModified().contains("README.md"));
                List<DiffEntry> workingDiff = mobile.diff().call();
                assertFalse(workingDiff.isEmpty());

                mobile.add().addFilepattern("README.md").call();
                Status staged = mobile.status().call();
                assertTrue(staged.getChanged().contains("README.md"));
                assertFalse(mobile.diff().setCached(true).call().isEmpty());

                RevCommit commit = mobile.commit().setMessage("mobile commit").call();
                assertEquals("mobile commit", commit.getShortMessage());
                mobile.push().call();

                mobile.checkout().setCreateBranch(true).setName("mobile-branch").call();
                assertEquals("mobile-branch", mobile.getRepository().getBranch());
                assertTrue(mobile.status().call().isClean());
            }

            try (Git verifier = Git.cloneRepository().setURI(remoteDirectory.toURI().toString()).setDirectory(verifierDirectory).call()) {
                RevCommit latest = verifier.log().setMaxCount(1).call().iterator().next();
                assertEquals("mobile commit", latest.getShortMessage());
                assertTrue(new String(Files.readAllBytes(new File(verifierDirectory, "README.md").toPath()), StandardCharsets.UTF_8).contains("mobile change"));
            }
        } finally {
            deleteRecursively(root);
        }
    }

    private static void configureIdentity(Git git) throws Exception {
        git.getRepository().getConfig().setString("user", null, "name", "Sharp-OSS Mobile Test");
        git.getRepository().getConfig().setString("user", null, "email", "mobile-test@sharp.local");
        git.getRepository().getConfig().save();
    }

    private static void deleteRecursively(File file) {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) deleteRecursively(child);
        file.delete();
    }
}
