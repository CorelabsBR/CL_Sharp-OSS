/**
 * Copyright (c) CoreLabs. Todos os direitos reservados.
 * Licenciado sob os termos da licença Proprietária CoreLabs.
 * Consulte o arquivo LICENSE na raiz do projeto para mais informações.
 */
package br.com.corelabs.npsharpfx.backend.git;

public record GitFileStatus(
        String repositoryName,
        String path,
        String oldPath,
        GitStatusKind kind,
        boolean staged,
        boolean conflicted,
        boolean ignored) {
}
