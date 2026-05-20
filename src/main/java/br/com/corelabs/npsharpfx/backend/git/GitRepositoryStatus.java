package br.com.corelabs.npsharpfx.backend.git;

import java.io.File;
import java.util.List;

public record GitRepositoryStatus(
        File root,
        String name,
        String branch,
        int ahead,
        int behind,
        List<GitFileStatus> changes,
        List<String> branches) {

    public boolean hasChanges() {
        return changes != null && !changes.isEmpty();
    }
}
