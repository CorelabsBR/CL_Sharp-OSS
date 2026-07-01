/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
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
