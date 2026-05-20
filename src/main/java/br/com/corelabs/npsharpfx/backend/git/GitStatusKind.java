package br.com.corelabs.npsharpfx.backend.git;

public enum GitStatusKind {
    MODIFIED("modified"),
    ADDED("added"),
    DELETED("deleted"),
    RENAMED("renamed"),
    UNTRACKED("untracked"),
    IGNORED("ignored"),
    CONFLICTED("conflicted");

    private final String label;

    GitStatusKind(String label) {
        this.label = label;
    }

    public String label() {
        return label;
    }
}
