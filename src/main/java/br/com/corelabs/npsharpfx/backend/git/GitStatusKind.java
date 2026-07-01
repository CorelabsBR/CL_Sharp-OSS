/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
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
